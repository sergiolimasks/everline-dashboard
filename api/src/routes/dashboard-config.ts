// Dashboard project/offer configs, filter builders, and shared SQL constants.
// No runtime side-effects — pure data + pure functions.

export const APPROVED_STATUSES = `('paid','Paid','approved','Aprovada','aprovada','Completa','completa')`;
export const TMB_PAID_STATUSES = `('Efetivado','Recebido')`;

// ========== PROJECT CONFIGS ==========

export interface LeadTableConfig {
  table: string;
  dateColumn: string;
  countExpression: string;
  phoneColumn: string;
  sourceName: string;
}

export interface ProjectConfig {
  metaTable: string;
  linksTable: string;
  greenSchema: string;
  principalProducts: string[];
  bumpProducts: string[];
  taxaFixaPorVenda: number;
  custoManychat: number;
  defaultMetaWhere: string;
  offerFilters: Record<string, OfferFilters>;
  leadConfigs: LeadTableConfig[];
  tmbTable?: string; // optional TMB sales table
}

export interface OfferFilters {
  metaWhere: string;
  principalProduct: string;
  useEmailLinkedBumps: boolean;
  leadSources?: string[]; // filter leadConfigs by sourceName
}

export const PROJECTS: Record<string, ProjectConfig> = {
  checkup: {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [
      'Check-up da Vida Financeira',
      'Check-up da Vida Financeira - Sem Order Bump',
      'Check-up da Vida Financeira 147',
      'Check-up da Vida Financeira 197',
      'Check-up da Vida Financeira 247',
    ],
    bumpProducts: ['Avaliação individual de um especialista', 'Check-up do CNPJ'],
    taxaFixaPorVenda: 18,
    custoManychat: 0.35,
    defaultMetaWhere: ` AND UPPER(campanha) LIKE '%CHECKUP%'`,
    offerFilters: {
      com_ob: {
        metaWhere: ` AND UPPER(campanha) LIKE '%CHECKUP%' AND UPPER(campanha) NOT LIKE '%S/OB%' AND UPPER(campanha) NOT LIKE '%147%' AND UPPER(campanha) NOT LIKE '%197%' AND UPPER(campanha) NOT LIKE '%247%' AND UPPER(campanha) NOT LIKE '%TESTE TICKETS%'`,
        principalProduct: 'Check-up da Vida Financeira',
        useEmailLinkedBumps: true,
      },
      sem_ob: {
        metaWhere: ` AND UPPER(campanha) LIKE '%S/OB%'`,
        principalProduct: 'Check-up da Vida Financeira - Sem Order Bump',
        useEmailLinkedBumps: true,
      },
      '147': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%147%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%147%'))`,
        principalProduct: 'Check-up da Vida Financeira 147',
        useEmailLinkedBumps: true,
      },
      '197': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%197%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%197%'))`,
        principalProduct: 'Check-up da Vida Financeira 197',
        useEmailLinkedBumps: true,
      },
      '247': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%247%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%247%'))`,
        principalProduct: 'Check-up da Vida Financeira 247',
        useEmailLinkedBumps: true,
      },
    },
    leadConfigs: [],
  },
  'formacao-consultor': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [
      'Formação Consultor 360',
      'Formação Consultor 360 (parcelado)',
    ],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    tmbTable: 'uelicon_database.controle_tmb',
    defaultMetaWhere: ` AND (UPPER(campanha) LIKE '%50K-DEZ25%' OR UPPER(campanha) LIKE '%LEADS APLICACAO%' OR UPPER(campanha) LIKE '%LEADS APLICAÇÃO%' OR UPPER(campanha) LIKE '%PRESENCIAL%' OR UPPER(campanha) LIKE '%RMKT FORMACAO%' OR UPPER(campanha) LIKE '%RMKT FORMAÇÃO%')`,
    offerFilters: {
      aplicacao: {
        metaWhere: ` AND (UPPER(campanha) LIKE '%LEADS APLICACAO%' OR UPPER(campanha) LIKE '%LEADS APLICAÇÃO%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Aplicação'],
      },
      '50k': {
        metaWhere: ` AND UPPER(campanha) LIKE '%50K-DEZ25%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Lançamento 50K'],
      },
      presencial: {
        metaWhere: ` AND UPPER(campanha) LIKE '%PRESENCIAL%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Presencial'],
      },
      rmkt: {
        metaWhere: ` AND (UPPER(campanha) LIKE '%RMKT FORMACAO%' OR UPPER(campanha) LIKE '%RMKT FORMAÇÃO%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [
      { table: 'bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Aplicação' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Lançamento 50K' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_presencial', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Presencial' },
    ],
  },
  'sistema-leads': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    defaultMetaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%'`,
    offerFilters: {
      'consulta-form': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%CONSULTA FORM%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'consulta-quiz': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%CONSULTA QUIZ%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'rating': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%RATING%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'limpa-nome': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%LIMPA NOME%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [],
  },
  'distribuicao': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    defaultMetaWhere: ` AND (UPPER(campanha) LIKE '%INSTAGRAM C1%' OR UPPER(campanha) LIKE '%INSTAGRAM C2%' OR UPPER(campanha) LIKE '%INSTAGRAM C3%' OR UPPER(campanha) LIKE '%POST DO INSTAGRAM:%')`,
    offerFilters: {
      'c1': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%INSTAGRAM C1%' OR UPPER(campanha) LIKE '%POST DO INSTAGRAM:%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'c2': {
        metaWhere: ` AND UPPER(campanha) LIKE '%INSTAGRAM C2%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'c3': {
        metaWhere: ` AND UPPER(campanha) LIKE '%INSTAGRAM C3%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [],
  },
};

// Unpaid account exclusions — these accounts had spend that was NOT actually paid
// so we exclude their raw gasto from CHECKUP meta queries only
export const UNPAID_EXCLUSIONS = ` AND NOT (conta = '1202066241345194' AND data::date >= '2026-03-10' AND data::date <= '2026-03-23' AND UPPER(campanha) LIKE '%CHECKUP%')`;

export function getProjectConfig(project: string): ProjectConfig {
  return PROJECTS[project] || PROJECTS['checkup'];
}

export function getOfferFiltersForProject(config: ProjectConfig, offer: string): OfferFilters & { isAllNoFilter?: boolean } {
  if (offer === 'all_no_filter') {
    return {
      metaWhere: config.defaultMetaWhere,
      principalProduct: '',
      useEmailLinkedBumps: false,
      isAllNoFilter: true,
    };
  }
  // Support multi-select offers (comma-separated) with OR logic
  if (offer && offer !== 'all' && offer.includes(',')) {
    const keys = offer.split(',').filter(k => config.offerFilters[k]);
    if (keys.length > 0) {
      const orClauses = keys.map(k => `(1=1 ${config.offerFilters[k].metaWhere})`);
      return {
        metaWhere: ` AND (${orClauses.join(' OR ')})`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      };
    }
  }
  if (offer && offer !== 'all' && config.offerFilters[offer]) {
    return config.offerFilters[offer];
  }
  return {
    metaWhere: config.defaultMetaWhere,
    principalProduct: '',
    useEmailLinkedBumps: false,
  };
}

// All principal products across ALL projects (for panel view)
export const ALL_PRINCIPAL_PRODUCTS = [
  ...PROJECTS['checkup'].principalProducts,
  ...PROJECTS['formacao-consultor'].principalProducts,
];

export const ALL_BUMP_PRODUCTS = [
  'Avaliação individual de um especialista',
  'Check-up do CNPJ',
];

export function principalFilter(config: ProjectConfig, productName: string): string {
  if (!productName) {
    if (config.principalProducts.length > 0) {
      const names = config.principalProducts.map(p => `'${p}'`).join(',');
      return `"Nome do produto" IN (${names})`;
    }
    return `1=0`;
  }
  return `"Nome do produto" = '${productName}'`;
}

export function bumpFilter(config: ProjectConfig, productName: string): string {
  if (config.bumpProducts.length === 0) return `1=0`;
  const bumpList = config.bumpProducts.map(p => `'${p}'`).join(',');
  if (!productName) {
    return `("Nome do produto" IN (${bumpList}))`;
  }
  return `("Nome do produto" IN (${bumpList}) AND "Email do cliente" IN (SELECT DISTINCT "Email do cliente" FROM ${config.greenSchema} WHERE "Nome do produto" = '${productName}' AND "Status da venda" IN ${APPROVED_STATUSES}))`;
}

export function allProductsFilter(config: ProjectConfig, productName: string): string {
  if (!productName) {
    const allNames = [...config.principalProducts, ...config.bumpProducts].map(p => `'${p}'`).join(',');
    return `"Nome do produto" IN (${allNames})`;
  }
  return `("Nome do produto" = '${productName}' OR ${bumpFilter(config, productName)})`;
}

