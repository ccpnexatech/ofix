import type { TourDefinition } from '../types';
import { defineTour } from '../types';

// Tour texts: pt-BR, direct, max 2 sentences per step (spec 009 + 012).

export const dashboardTour = defineTour({
  id: 'dashboard',
  steps: [
    {
      target: '[data-tour="dashboard-stats"]',
      title: 'Os números do dia',
      body: 'OS abertas, atrasadas, receita e tempo médio de reparo — tudo do período atual.',
    },
    {
      target: '[data-tour="branch-selector"]',
      title: 'Escolha a filial',
      body: 'Alterne entre todas as filiais ou uma específica. O filtro fica na URL e vale para a tela toda.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="revenue-chart"]',
      title: 'Receita dos últimos 6 meses',
      body: 'Soma dos orçamentos aprovados das OS entregues em cada mês.',
      placement: 'top',
    },
    {
      target: '[data-tour="attention-table"]',
      title: 'O que precisa de você',
      body: 'OS atrasadas ou urgentes. Clique no código para abrir direto.',
      placement: 'top',
    },
    {
      // Chega na Fase 11 (spec 010) — até lá o passo é pulado em silêncio.
      target: '[data-tour="ai-insights"]',
      title: 'Análise da IA',
      body: 'Insights automáticos sobre o desempenho da operação.',
      placement: 'top',
    },
  ],
});

export const ordersListTour = defineTour({
  id: 'orders-list',
  steps: [
    {
      target: '[data-tour="orders-filters"]',
      title: 'Filtros combináveis',
      body: 'Status, prioridade e filial se somam. Os filtros ativos viram chips removíveis.',
    },
    {
      target: '[data-tour="global-search"]',
      title: 'Busca global',
      body: 'Procure por código da OS, nome do cliente ou equipamento de qualquer tela.',
    },
    {
      target: '[data-tour="orders-table"] [data-status]',
      title: 'Status sempre visível',
      body: 'Cada cor e ícone é um estágio do reparo. A mesma legenda vale no app inteiro.',
    },
    {
      target: '[data-tour="new-order"]',
      title: 'Nova OS em 4 passos',
      body: 'Cliente, equipamento, problema e revisão — dá até para cadastrar o cliente no caminho.',
      placement: 'left',
    },
  ],
});

export const orderDetailTour = defineTour({
  id: 'order-detail',
  steps: [
    {
      target: '[data-tour="order-header"]',
      title: 'A identidade da OS',
      body: 'Código, status atual, prioridade, filial e prazo (com alerta de atraso).',
    },
    {
      target: '[data-tour="transition-panel"]',
      title: 'Painel de ações',
      body: 'Só aparecem as ações válidas para o status atual e para o seu papel.',
      placement: 'left',
    },
    {
      target: '[data-tour="quote-card"]',
      title: 'Orçamento',
      body: 'Monte os itens, envie e copie o link público para o cliente aprovar sem login.',
      placement: 'top',
    },
    {
      target: '[data-tour="order-timeline"]',
      title: 'Linha do tempo',
      body: 'Auditoria completa: quem fez o quê e quando — inclusive o cliente pelo link.',
      placement: 'left',
    },
    {
      target: '[data-tour="warranty-card"]',
      title: 'Garantia',
      body: 'OS entregues têm 90 dias de garantia. Reabrir cria uma nova OS vinculada.',
      placement: 'top',
    },
  ],
});

export const orderNewTour = defineTour({
  id: 'order-new',
  steps: [
    {
      target: '[data-tour="wizard-steps"]',
      title: 'Quatro passos',
      body: 'Cliente, equipamento, detalhes e revisão. Você pode voltar a qualquer momento.',
    },
    {
      target: '[data-tour="wizard-card"]',
      title: 'Busque ou cadastre',
      body: 'Procure um cliente existente ou preencha os campos para criar um novo na hora.',
      placement: 'top',
    },
  ],
});

export const customersTour = defineTour({
  id: 'customers',
  steps: [
    {
      target: '[data-tour="customers-search"]',
      title: 'Encontre o cliente',
      body: 'Busque por nome, telefone ou e-mail.',
    },
    {
      target: '[data-tour="customers-table"]',
      title: 'Perfil completo',
      body: 'Clique numa linha para abrir o perfil com equipamentos e todo o histórico de OS.',
    },
    {
      target: '[data-tour="new-customer"]',
      title: 'Cadastro rápido',
      body: 'Nome e telefone bastam para começar.',
      placement: 'left',
    },
  ],
});

export const branchesMapTour = defineTour({
  id: 'branches-map',
  steps: [
    {
      target: '[data-tour="map-area"]',
      title: 'Suas unidades no mapa',
      body: 'Cada pin é uma filial ativa com endereço cadastrado. Clique para ver os detalhes.',
    },
    {
      target: '[data-tour="branch-cards"]',
      title: 'Lista das filiais',
      body: 'Endereço e telefone de cada unidade — incluindo as que ainda não têm coordenadas.',
      placement: 'top',
    },
    {
      target: '[data-tour="copy-map-link"]',
      title: 'Compartilhe com clientes',
      body: 'Copia um link público do mapa, sem login. Dá para revogar o link via script quando quiser.',
      placement: 'left',
    },
    {
      // Só admins veem o botão — para os demais o passo é pulado em silêncio.
      target: '[data-tour="new-branch"]',
      title: 'Abriu uma unidade nova?',
      body: 'Cadastre a filial aqui mesmo. Com latitude e longitude ela entra no mapa na hora.',
      placement: 'left',
    },
  ],
});

export const settingsUsersTour = defineTour({
  id: 'settings-users',
  steps: [
    {
      target: '[data-tour="new-user"]',
      title: 'Convide a equipe',
      body: 'Crie usuários com senha inicial — peça para trocarem no primeiro acesso.',
      placement: 'left',
    },
    {
      target: '[data-tour="users-table"]',
      title: 'Papéis',
      body: 'Admin gerencia tudo; técnico opera as próprias OS; atendente cuida da recepção e entrega.',
    },
    {
      target: '[data-tour="users-table"]',
      title: 'Escopo de filial',
      body: 'Usuário com filial fixa só enxerga a unidade dele. Sem filial, vê o tenant inteiro.',
    },
  ],
});

export const ALL_TOURS: TourDefinition[] = [
  dashboardTour,
  ordersListTour,
  orderDetailTour,
  orderNewTour,
  customersTour,
  branchesMapTour,
  settingsUsersTour,
];

/** Route → tour mapping used by auto-start and the floating "?" button. */
export function findTourForPath(pathname: string): TourDefinition | undefined {
  if (pathname.startsWith('/dashboard')) {
    return dashboardTour;
  }
  if (pathname === '/orders/new') {
    return orderNewTour;
  }
  if (/^\/orders\/[^/]+$/.test(pathname)) {
    return orderDetailTour;
  }
  if (pathname.startsWith('/orders')) {
    return ordersListTour;
  }
  if (pathname.startsWith('/customers')) {
    return customersTour;
  }
  if (pathname.startsWith('/branches/map')) {
    return branchesMapTour;
  }
  if (pathname.startsWith('/settings/users')) {
    return settingsUsersTour;
  }
  return undefined;
}
