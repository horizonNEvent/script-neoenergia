import { AmbienteTUST, Transmissora } from '@/types/tust';
import defaultTransmissorasJson from '@/data/transmissoras.json';

export const AMBIENTES_TUST: AmbienteTUST[] = [
  {
    id: 'AMERICAENERGIA',
    nome: 'AMERICA ENERGIA',
    url: 'https://tust-americaenergia.rsmbrasil.com.br',
    usuarioPadrao: 'BRUNOVOLLU',
    senhaPadrao: 'Bvlu@2023',
  },
  {
    id: 'RIOENERGY',
    nome: 'RIO ENERGY',
    url: 'https://tust.rsmbrasil.com.br',
    usuarioPadrao: '',
    senhaPadrao: '',
  },
  {
    id: 'DIAMANTEENERGIA',
    nome: 'DIAMANTE ENERGIA',
    url: 'https://tust-diamanteenergia.rsmbrasil.com.br',
    usuarioPadrao: '',
    senhaPadrao: '',
  },
  {
    id: 'ATLASENERGY',
    nome: 'ATLAS ENERGY',
    url: 'https://tust-atlasenergy.pollvo.com/',
    usuarioPadrao: '',
    senhaPadrao: '',
  },
  {
    id: 'AETECAPITAL',
    nome: 'AETE CAPITAL',
    url: 'https://tust-aetecapital.pollvo.com/',
    usuarioPadrao: '',
    senhaPadrao: '',
  },
  {
    id: 'CUSTOM',
    nome: 'Outro (URL Customizada)',
    url: '',
    usuarioPadrao: '',
    senhaPadrao: '',
  },
];

export const DEFAULT_TRANSMISSORAS: Transmissora[] = defaultTransmissorasJson as Transmissora[];
