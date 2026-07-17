export type Destination = {
  slug: string
  name: string
  state: string
  image: string
  pousadas: number
  rating: number
  priceFrom: number
  season: Season[]
}

export type Experience = {
  slug: string
  name: string
  icon: string
  description: string
}

export type Pousada = {
  slug: string
  name: string
  city: string
  state: string
  image: string
  gallery: string[]
  rating: number
  reviews: number
  pricePerNight: number
  tags: string[]
  description: string
}

export type Season = 'verao' | 'outono' | 'inverno' | 'primavera'

export const destinations: Destination[] = [
  {
    slug: 'serra-da-canastra',
    name: 'Serra da Canastra',
    state: 'MG',
    image: '/images/canastra.png',
    pousadas: 48,
    rating: 4.9,
    priceFrom: 340,
    season: ['primavera', 'outono'],
  },
  {
    slug: 'gramado',
    name: 'Gramado',
    state: 'RS',
    image: '/images/gramado.png',
    pousadas: 212,
    rating: 4.8,
    priceFrom: 520,
    season: ['inverno'],
  },
  {
    slug: 'monte-verde',
    name: 'Monte Verde',
    state: 'MG',
    image: '/images/monteverde.png',
    pousadas: 96,
    rating: 4.8,
    priceFrom: 410,
    season: ['inverno'],
  },
  {
    slug: 'capitolio',
    name: 'Capitólio',
    state: 'MG',
    image: '/images/capitolio.png',
    pousadas: 74,
    rating: 4.7,
    priceFrom: 380,
    season: ['verao'],
  },
  {
    slug: 'bonito',
    name: 'Bonito',
    state: 'MS',
    image: '/images/bonito.png',
    pousadas: 63,
    rating: 4.9,
    priceFrom: 460,
    season: ['verao', 'primavera'],
  },
  {
    slug: 'jalapao',
    name: 'Jalapão',
    state: 'TO',
    image: '/images/jalapao.png',
    pousadas: 27,
    rating: 4.9,
    priceFrom: 590,
    season: ['verao'],
  },
  {
    slug: 'campos-do-jordao',
    name: 'Campos do Jordão',
    state: 'SP',
    image: '/images/campos.png',
    pousadas: 158,
    rating: 4.7,
    priceFrom: 490,
    season: ['inverno'],
  },
  {
    slug: 'fernando-de-noronha',
    name: 'Fernando de Noronha',
    state: 'PE',
    image: '/images/noronha.png',
    pousadas: 41,
    rating: 5.0,
    priceFrom: 890,
    season: ['verao'],
  },
]

export const experiences: Experience[] = [
  { slug: 'chales-romanticos', name: 'Chalés Românticos', icon: 'Heart', description: 'Refúgios a dois com lareira e vista.' },
  { slug: 'natureza', name: 'Natureza', icon: 'Trees', description: 'Imersão total em meio à mata.' },
  { slug: 'luxo', name: 'Luxo', icon: 'Gem', description: 'Alta hotelaria e serviço impecável.' },
  { slug: 'pet-friendly', name: 'Pet Friendly', icon: 'PawPrint', description: 'Traga quem você ama, todos eles.' },
  { slug: 'piscina-aquecida', name: 'Piscina Aquecida', icon: 'WavesLadder', description: 'Mergulhe em qualquer estação.' },
  { slug: 'cachoeiras', name: 'Cachoeiras', icon: 'Droplets', description: 'Águas cristalinas ao seu alcance.' },
  { slug: 'fazenda', name: 'Fazenda', icon: 'Wheat', description: 'O ritmo bom da vida no campo.' },
  { slug: 'glamping', name: 'Glamping', icon: 'Tent', description: 'Acampar com sofisticação.' },
  { slug: 'ecoturismo', name: 'Ecoturismo', icon: 'Leaf', description: 'Viaje leve, com propósito.' },
  { slug: 'serra', name: 'Serra', icon: 'Mountain', description: 'Ar puro e horizontes infinitos.' },
  { slug: 'praia', name: 'Praia', icon: 'Sun', description: 'O mar como quintal.' },
  { slug: 'cabanas', name: 'Cabanas', icon: 'Home', description: 'Aconchego de madeira e silêncio.' },
]

export const pousadas: Pousada[] = [
  {
    slug: 'refugio-das-nuvens',
    name: 'Refúgio das Nuvens',
    city: 'Monte Verde',
    state: 'MG',
    image: '/images/pousada-1.png',
    gallery: ['/images/pousada-1.png', '/images/gallery-1.png', '/images/gallery-2.png', '/images/gallery-3.png', '/images/gallery-4.png'],
    rating: 4.9,
    reviews: 328,
    pricePerNight: 720,
    tags: ['Chalés Românticos', 'Lareira', 'Serra', 'Pet Friendly'],
    description:
      'Encravado entre araucárias e neblina, o Refúgio das Nuvens é um convite ao descanso absoluto. Cada chalé foi desenhado para emoldurar a paisagem da serra, com lareira a lenha, banheira de imersão e varanda privativa suspensa sobre o vale.',
  },
  {
    slug: 'vale-esmeralda',
    name: 'Vale Esmeralda Boutique',
    city: 'Capitólio',
    state: 'MG',
    image: '/images/pousada-2.png',
    gallery: ['/images/pousada-2.png', '/images/gallery-4.png', '/images/gallery-1.png', '/images/gallery-3.png', '/images/gallery-2.png'],
    rating: 4.8,
    reviews: 214,
    pricePerNight: 640,
    tags: ['Piscina Aquecida', 'Luxo', 'Cachoeiras', 'Vista'],
    description:
      'Design minimalista e uma piscina de borda infinita sobre o cânion. O Vale Esmeralda combina arquitetura contemporânea com o verde exuberante de Minas, para quem busca contemplação e sofisticação em igual medida.',
  },
  {
    slug: 'cabana-do-cerrado',
    name: 'Cabana do Cerrado',
    city: 'Jalapão',
    state: 'TO',
    image: '/images/pousada-3.png',
    gallery: ['/images/pousada-3.png', '/images/gallery-3.png', '/images/gallery-2.png', '/images/gallery-1.png', '/images/gallery-4.png'],
    rating: 5.0,
    reviews: 156,
    pricePerNight: 980,
    tags: ['Glamping', 'Ecoturismo', 'Natureza', 'Aventura'],
    description:
      'Uma experiência de glamping de alto padrão em pleno Jalapão. Suítes de lona com estrutura premium, céu estrelado sem poluição luminosa e roteiros guiados pelas dunas douradas e fervedouros de água azul.',
  },
  {
    slug: 'casa-do-mar-noronha',
    name: 'Casa do Mar Noronha',
    city: 'Fernando de Noronha',
    state: 'PE',
    image: '/images/pousada-4.png',
    gallery: ['/images/pousada-4.png', '/images/gallery-1.png', '/images/gallery-4.png', '/images/gallery-3.png', '/images/gallery-2.png'],
    rating: 5.0,
    reviews: 402,
    pricePerNight: 1680,
    tags: ['Praia', 'Luxo', 'Vista Mar', 'Café Premium'],
    description:
      'Debruçada sobre uma das baías mais bonitas do mundo, a Casa do Mar oferece suítes com varanda voltada para o oceano, café da manhã autoral e o silêncio raro de um paraíso preservado.',
  },
]

export const amenities = [
  'Wi-Fi de alta velocidade',
  'Café da manhã incluso',
  'Lareira a lenha',
  'Banheira de imersão',
  'Piscina aquecida',
  'Estacionamento gratuito',
  'Aceita pets',
  'Ar-condicionado',
  'Vista para o vale',
  'Serviço de quarto',
  'Spa & massagem',
  'Trilhas guiadas',
]

export const rooms = [
  { name: 'Chalé Vale', price: 720, guests: 2, size: '42 m²', desc: 'Lareira, banheira e varanda com vista.' },
  { name: 'Suíte Bosque', price: 890, guests: 3, size: '58 m²', desc: 'Living privativo e deck com ofurô.' },
  { name: 'Master Panorâmica', price: 1240, guests: 4, size: '76 m²', desc: 'Dois ambientes e vista 180° do vale.' },
]

export const reviews = [
  { name: 'Marina Alves', location: 'São Paulo, SP', rating: 5, text: 'A vista da varanda ao amanhecer é de tirar o fôlego. Voltaremos com certeza — cada detalhe é impecável.' },
  { name: 'Rafael e Bianca', location: 'Belo Horizonte, MG', rating: 5, text: 'Lua de mel perfeita. A lareira, o café da manhã e o atendimento fizeram tudo virar memória para a vida toda.' },
  { name: 'Carla Menezes', location: 'Rio de Janeiro, RJ', rating: 4, text: 'Lugar lindíssimo e tranquilo. O spa foi o ponto alto da viagem. Recomendo demais para casais.' },
]
