import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';

import {
  AssistantModelClient,
  type ModelCallParams,
  type ModelStreamHandlers,
} from './model-client';

/**
 * The tractor (ADR-012): a deterministic responder behind the same model
 * contract. Data questions become real tool calls through the existing agent
 * loop; usage questions become keyword search over the generated docs;
 * anything else falls back honestly. No external calls, no cost, and —
 * by construction — no hallucination: it only quotes the docs and the
 * tenant's own data.
 */

const STOPWORDS = new Set(
  'a o e de da do das dos um uma em no na nos nas que qual quais como para por com sem ao aos meu minha seu sua é sao são esta está estão foi ser ter tem você eu ele ela isso essa esse onde quando posso pode consigo'.split(
    ' ',
  ),
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

interface DocSection {
  title: string;
  body: string;
  tokens: Set<string>;
}

function textMessage(text: string): Anthropic.Message {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  } as unknown as Anthropic.Message;
}

function toolMessage(name: string, input: Record<string, unknown>): Anthropic.Message {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: `local-${name}`, name, input }],
  } as unknown as Anthropic.Message;
}

const SUGGESTIONS_TEXT = [
  'Não encontrei isso na documentação. Posso ajudar com:',
  '- **Dados da sua operação**: "quais OS estão atrasadas?", "status da OS-2026-0042", "cliente Maria"',
  '- **Como usar o OFIX**: "como funciona a garantia?", "como aprovo um orçamento presencialmente?"',
].join('\n');

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recebida',
  IN_DIAGNOSIS: 'Em diagnóstico',
  QUOTE_SENT: 'Orçamento enviado',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
  IN_REPAIR: 'Em reparo',
  READY: 'Pronta',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelada',
};

const STATUS_SYNONYMS: [RegExp, string][] = [
  [/recebid/, 'RECEIVED'],
  [/diagnostic/, 'IN_DIAGNOSIS'],
  [/orcamento enviado|aguardando (o )?cliente/, 'QUOTE_SENT'],
  [/aprovad/, 'APPROVED'],
  [/recusad|rejeitad/, 'REJECTED'],
  [/em reparo|consert/, 'IN_REPAIR'],
  [/prontas?\b/, 'READY'],
  [/entregue/, 'DELIVERED'],
  [/cancelad/, 'CANCELED'],
];

interface OrderSummaryJson {
  code: string;
  status: string;
  prioridade: string;
  cliente: string;
  equipamento: string;
  filial: string;
  tecnico: string | null;
  prazo: string | null;
}

function formatOrderLine(order: OrderSummaryJson): string {
  const status = STATUS_LABELS[order.status] ?? order.status;
  const tech = order.tecnico === null ? 'sem técnico' : `técnico ${order.tecnico}`;
  const due = order.prazo === null ? '' : `, prazo ${order.prazo.split('-').reverse().join('/')}`;
  return `- **${order.code}** — ${status} · ${order.cliente} (${order.equipamento}) · ${order.filial}, ${tech}${due}`;
}

function currency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Injectable()
export class LocalAssistantModel extends AssistantModelClient {
  private readonly sections: DocSection[];

  constructor() {
    super();
    const context = readFileSync(join(__dirname, 'context.generated.md'), 'utf8');
    this.sections = this.parseSections(context);
  }

  available(): boolean {
    return true;
  }

  private parseSections(markdown: string): DocSection[] {
    const sections: DocSection[] = [];
    let title = '';
    let lines: string[] = [];
    const push = () => {
      const body = lines.join('\n').trim();
      if (title !== '' && body !== '') {
        sections.push({ title, body, tokens: new Set([...tokens(title), ...tokens(body)]) });
      }
    };
    for (const line of markdown.split('\n')) {
      if (/^#{2,3}\s/.test(line)) {
        push();
        title = line.replace(/^#+\s*/, '');
        lines = [];
      } else {
        lines.push(line);
      }
    }
    push();
    return sections;
  }

  /** Keyword search over the docs; returns the best-matching section. */
  private searchDocs(question: string): string | null {
    const query = tokens(question);
    if (query.length === 0) {
      return null;
    }
    let best: DocSection | null = null;
    let bestScore = 0;
    for (const section of this.sections) {
      let score = 0;
      for (const token of query) {
        if (section.tokens.has(token)) {
          score += 1;
        }
      }
      // Title hits weigh double: "garantia" should land on the warranty section.
      for (const token of tokens(section.title)) {
        if (query.includes(token)) {
          score += 2;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = section;
      }
    }
    if (best === null || bestScore < 2) {
      return null;
    }
    const body = best.body
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images make no sense in chat
      .replace(/\*Legenda:[^*]*\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const excerpt = body.length > 900 ? `${body.slice(0, 900).trimEnd()}…` : body;
    return `**${best.title}** (do guia de uso)\n\n${excerpt}`;
  }

  /** Classifies the user question into a data intent (tool) or null. */
  private classify(question: string): { name: string; input: Record<string, unknown> } | null {
    const plain = normalize(question);
    // Real codes are OS-AAAA-NNNN, but any OS-…-… token counts as a lookup.
    const code = /\bos-[a-z0-9]+-[a-z0-9]+\b/.exec(plain);
    if (code) {
      return { name: 'get_order_by_code', input: { code: code[0] } };
    }
    if (/atrasad|vencid|estourad/.test(plain)) {
      return { name: 'get_overdue_orders', input: {} };
    }
    const customer = /cliente\s+(.{2,40})$/.exec(question.trim());
    if (customer?.[1] !== undefined) {
      return {
        name: 'search_customer',
        input: { name: customer[1].replace(/[?.!]+$/, '').trim() },
      };
    }
    if (/metric|resumo|numeros|receita|ticket|taxa de aprovacao|desempenho|dashboard/.test(plain)) {
      return { name: 'get_dashboard_summary', input: {} };
    }
    for (const [pattern, status] of STATUS_SYNONYMS) {
      if (pattern.test(plain) && /\bos\b|ordens|listar?|quais|quantas/.test(plain)) {
        return { name: 'search_orders', input: { status } };
      }
    }
    return null;
  }

  /** Templated pt-BR answer from a real tool result. */
  private formatToolAnswer(toolName: string, resultJson: string): string {
    if (resultJson.startsWith('Nenhuma OS')) {
      return 'Não encontrei nenhuma OS com esse código no seu escopo de acesso. Confira o código (formato OS-AAAA-NNNN) na lista de Ordens de serviço.';
    }
    try {
      const parsed = JSON.parse(resultJson) as unknown;
      switch (toolName) {
        case 'get_order_by_code': {
          const order = parsed as OrderSummaryJson;
          const status = STATUS_LABELS[order.status] ?? order.status;
          return [
            `A **${order.code}** está em **${status}**.`,
            formatOrderLine(order),
            'Para agir nela, abra a OS e use o painel **Ações** à direita.',
          ].join('\n');
        }
        case 'get_overdue_orders': {
          const orders = parsed as OrderSummaryJson[];
          if (orders.length === 0) {
            return 'Boa notícia: **nenhuma OS atrasada** no seu escopo agora.';
          }
          return [
            `Você tem **${String(orders.length)} OS atrasada(s)**:`,
            ...orders.map(formatOrderLine),
            'Abra cada uma pelo código na tela de Ordens de serviço.',
          ].join('\n');
        }
        case 'search_orders': {
          const orders = parsed as OrderSummaryJson[];
          if (orders.length === 0) {
            return 'Não encontrei OS nesse filtro dentro do seu escopo.';
          }
          return [`Encontrei **${String(orders.length)} OS**:`, ...orders.map(formatOrderLine)].join(
            '\n',
          );
        }
        case 'search_customer': {
          const customers = parsed as {
            nome: string;
            telefone: string;
            email: string | null;
            ultimasOS: { code: string; status: string }[];
          }[];
          if (customers.length === 0) {
            return 'Não encontrei cliente com esse nome. Confira na tela **Clientes** (busca por nome, telefone ou e-mail).';
          }
          return customers
            .map((customer) => {
              const orders =
                customer.ultimasOS.length === 0
                  ? 'sem OS no seu escopo'
                  : customer.ultimasOS
                      .map((o) => `${o.code} (${STATUS_LABELS[o.status] ?? o.status})`)
                      .join(', ');
              return `**${customer.nome}** — ${customer.telefone}${customer.email === null ? '' : ` · ${customer.email}`}\nÚltimas OS: ${orders}`;
            })
            .join('\n\n');
        }
        case 'get_dashboard_summary': {
          const summary = parsed as {
            openOrders: number;
            overdueOrders: number;
            revenueCents: number;
            avgTicketCents: number;
            quoteApprovalRate: number | null;
            avgRepairTimeHours: number | null;
          };
          const lines = [
            'Resumo do período atual:',
            `- **OS abertas:** ${String(summary.openOrders)} (${String(summary.overdueOrders)} atrasada(s))`,
            `- **Receita do mês:** ${currency(summary.revenueCents)} · ticket médio ${currency(summary.avgTicketCents)}`,
          ];
          if (summary.quoteApprovalRate !== null) {
            lines.push(
              `- **Taxa de aprovação:** ${String(Math.round(summary.quoteApprovalRate * 100))}%`,
            );
          }
          if (summary.avgRepairTimeHours !== null) {
            lines.push(
              `- **Tempo médio de reparo:** ${(summary.avgRepairTimeHours / 24).toFixed(1)} dias`,
            );
          }
          lines.push('Os detalhes estão no **Dashboard**, com o seletor de filial no topo.');
          return lines.join('\n');
        }
        default:
          return resultJson;
      }
    } catch {
      return 'Consegui consultar, mas não consegui formatar o resultado. Tente de novo.';
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- fulfils the async AssistantModelClient contract synchronously
  async stream(params: ModelCallParams, handlers: ModelStreamHandlers): Promise<Anthropic.Message> {
    const last = params.messages.at(-1);

    // Phase 2 of the loop: a tool result came back — format the final answer.
    if (Array.isArray(last?.content)) {
      const result = last.content.find(
        (block): block is Anthropic.ToolResultBlockParam =>
          typeof block === 'object' && block.type === 'tool_result',
      );
      const previous = params.messages.at(-2);
      const toolUse = Array.isArray(previous?.content)
        ? previous.content.find(
            (block): block is Anthropic.ToolUseBlock =>
              typeof block === 'object' && block.type === 'tool_use',
          )
        : undefined;
      const answer = this.formatToolAnswer(
        toolUse?.name ?? '',
        typeof result?.content === 'string' ? result.content : '',
      );
      this.emit(answer, handlers);
      return textMessage(answer);
    }

    // Phase 1: classify the question.
    const question = typeof last?.content === 'string' ? last.content : '';
    const intent = this.classify(question);
    if (intent !== null) {
      return toolMessage(intent.name, intent.input);
    }

    const fromDocs = this.searchDocs(question);
    const answer = fromDocs ?? SUGGESTIONS_TEXT;
    this.emit(answer, handlers);
    return textMessage(answer);
  }

  private emit(text: string, handlers: ModelStreamHandlers): void {
    for (const chunk of text.match(/.{1,32}/gs) ?? []) {
      handlers.onTextDelta(chunk);
    }
  }

  /** Deterministic dashboard insights over the same metrics (ADR-012). */
  // eslint-disable-next-line @typescript-eslint/require-await -- fulfils the async AssistantModelClient contract synchronously
  async complete(params: ModelCallParams): Promise<Anthropic.Message> {
    const prompt =
      typeof params.messages[0]?.content === 'string' ? params.messages[0].content : '';
    // The metrics JSON comes after the explicit marker — the format example
    // earlier in the prompt also contains braces.
    const marker = prompt.indexOf('Métricas: ');
    const metrics = JSON.parse(
      marker === -1 ? '{}' : prompt.slice(marker + 'Métricas: '.length),
    ) as {
      resumo?: {
        openOrders: number;
        overdueOrders: number;
        revenueCents: number;
        avgTicketCents: number;
        quoteApprovalRate: number | null;
        deliveredCount: number;
      };
      porStatus?: { status: string; count: number }[];
    };
    const resumo = metrics.resumo;
    const insights: string[] = [];
    if (resumo) {
      insights.push(
        resumo.overdueOrders > 0
          ? `Você tem ${String(resumo.overdueOrders)} OS atrasada(s) de ${String(resumo.openOrders)} aberta(s) — priorize-as hoje na tabela "Atrasadas e urgentes" para proteger o prazo prometido.`
          : `Nenhuma das ${String(resumo.openOrders)} OS abertas está atrasada — os prazos prometidos estão sob controle.`,
      );
      if (resumo.quoteApprovalRate !== null) {
        const rate = Math.round(resumo.quoteApprovalRate * 100);
        insights.push(
          rate < 70
            ? `A taxa de aprovação de orçamentos está em ${String(rate)}% — revise valores de mão de obra ou o tempo de resposta ao cliente.`
            : `Taxa de aprovação de orçamentos em ${String(rate)}% — o padrão de orçamentos está funcionando; mantenha.`,
        );
      }
      insights.push(
        resumo.deliveredCount > 0
          ? `O mês tem ${currency(resumo.revenueCents)} de receita em ${String(resumo.deliveredCount)} entrega(s) (ticket médio ${currency(resumo.avgTicketCents)}) — receita só conta na entrega, então acelerar OS prontas aumenta o número.`
          : 'Ainda não há entregas no mês — a receita só é contabilizada na entrega, então concluir as OS em andamento é o caminho mais curto para faturar.',
      );
    }
    const busiest = (metrics.porStatus ?? [])
      .filter((bucket) => !['DELIVERED', 'CANCELED'].includes(bucket.status))
      .sort((a, b) => b.count - a.count)[0];
    if (busiest && busiest.count > 0) {
      insights.push(
        `O maior acúmulo está em "${STATUS_LABELS[busiest.status] ?? busiest.status}" (${String(busiest.count)} OS) — vale investigar se há gargalo nessa etapa.`,
      );
    }
    while (insights.length < 3) {
      insights.push(
        'Use o seletor de filial no topo do dashboard para comparar unidades e encontrar onde agir primeiro.',
      );
    }
    return textMessage(JSON.stringify({ insights: insights.slice(0, 5) }));
  }
}
