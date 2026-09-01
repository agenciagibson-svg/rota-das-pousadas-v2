-- =============================================================================
-- Seed de dados de referência (destinos, experiências, amenities).
-- Idempotente via ON CONFLICT. Executar após as migrations.
-- Espelha os dados de curadoria hoje em lib/data.ts.
-- =============================================================================

insert into destinations (slug, name, state, image, pousadas_count, rating, price_from, season) values
  ('serra-da-canastra', 'Serra da Canastra', 'MG', '/images/canastra.png', 48, 4.9, 340, '{primavera,outono}'),
  ('gramado', 'Gramado', 'RS', '/images/gramado.png', 212, 4.8, 520, '{inverno}'),
  ('monte-verde', 'Monte Verde', 'MG', '/images/monteverde.png', 96, 4.8, 410, '{inverno}'),
  ('capitolio', 'Capitólio', 'MG', '/images/capitolio.png', 74, 4.7, 380, '{verao}'),
  ('bonito', 'Bonito', 'MS', '/images/bonito.png', 63, 4.9, 460, '{verao,primavera}'),
  ('jalapao', 'Jalapão', 'TO', '/images/jalapao.png', 27, 4.9, 590, '{verao}'),
  ('campos-do-jordao', 'Campos do Jordão', 'SP', '/images/campos.png', 158, 4.7, 490, '{inverno}'),
  ('fernando-de-noronha', 'Fernando de Noronha', 'PE', '/images/noronha.png', 41, 5.0, 890, '{verao}')
on conflict (slug) do nothing;

insert into experiences (slug, name, icon, description) values
  ('chales-romanticos', 'Chalés Românticos', 'Heart', 'Refúgios a dois com lareira e vista.'),
  ('natureza', 'Natureza', 'Trees', 'Imersão total em meio à mata.'),
  ('luxo', 'Luxo', 'Gem', 'Alta hotelaria e serviço impecável.'),
  ('pet-friendly', 'Pet Friendly', 'PawPrint', 'Traga quem você ama, todos eles.'),
  ('piscina-aquecida', 'Piscina Aquecida', 'WavesLadder', 'Mergulhe em qualquer estação.'),
  ('cachoeiras', 'Cachoeiras', 'Droplets', 'Águas cristalinas ao seu alcance.'),
  ('fazenda', 'Fazenda', 'Wheat', 'O ritmo bom da vida no campo.'),
  ('glamping', 'Glamping', 'Tent', 'Acampar com sofisticação.'),
  ('ecoturismo', 'Ecoturismo', 'Leaf', 'Viaje leve, com propósito.'),
  ('serra', 'Serra', 'Mountain', 'Ar puro e horizontes infinitos.'),
  ('praia', 'Praia', 'Sun', 'O mar como quintal.'),
  ('cabanas', 'Cabanas', 'Home', 'Aconchego de madeira e silêncio.')
on conflict (slug) do nothing;

-- Pousadas da curadoria inicial (espelham lib/data.ts; status publicada para
-- que o catálogo continue idêntico após a troca de mock → banco).
insert into pousadas (slug, name, city, state, image, gallery, rating, reviews, price_per_night, tags, description, status) values
  ('refugio-das-nuvens', 'Refúgio das Nuvens', 'Monte Verde', 'MG', '/images/pousada-1.png',
   '{/images/pousada-1.png,/images/gallery-1.png,/images/gallery-2.png,/images/gallery-3.png,/images/gallery-4.png}',
   4.9, 328, 720, '{Chalés Românticos,Lareira,Serra,Pet Friendly}',
   'Encravado entre araucárias e neblina, o Refúgio das Nuvens é um convite ao descanso absoluto. Cada chalé foi desenhado para emoldurar a paisagem da serra, com lareira a lenha, banheira de imersão e varanda privativa suspensa sobre o vale.', 'publicada'),
  ('vale-esmeralda', 'Vale Esmeralda Boutique', 'Capitólio', 'MG', '/images/pousada-2.png',
   '{/images/pousada-2.png,/images/gallery-4.png,/images/gallery-1.png,/images/gallery-3.png,/images/gallery-2.png}',
   4.8, 214, 640, '{Piscina Aquecida,Luxo,Cachoeiras,Vista}',
   'Design minimalista e uma piscina de borda infinita sobre o cânion. O Vale Esmeralda combina arquitetura contemporânea com o verde exuberante de Minas, para quem busca contemplação e sofisticação em igual medida.', 'publicada'),
  ('cabana-do-cerrado', 'Cabana do Cerrado', 'Jalapão', 'TO', '/images/pousada-3.png',
   '{/images/pousada-3.png,/images/gallery-3.png,/images/gallery-2.png,/images/gallery-1.png,/images/gallery-4.png}',
   5.0, 156, 980, '{Glamping,Ecoturismo,Natureza,Aventura}',
   'Uma experiência de glamping de alto padrão em pleno Jalapão. Suítes de lona com estrutura premium, céu estrelado sem poluição luminosa e roteiros guiados pelas dunas douradas e fervedouros de água azul.', 'publicada'),
  ('casa-do-mar-noronha', 'Casa do Mar Noronha', 'Fernando de Noronha', 'PE', '/images/pousada-4.png',
   '{/images/pousada-4.png,/images/gallery-1.png,/images/gallery-4.png,/images/gallery-3.png,/images/gallery-2.png}',
   5.0, 402, 1680, '{Praia,Luxo,Vista Mar,Café Premium}',
   'Debruçada sobre uma das baías mais bonitas do mundo, a Casa do Mar oferece suítes com varanda voltada para o oceano, café da manhã autoral e o silêncio raro de um paraíso preservado.', 'publicada')
on conflict (slug) do nothing;

insert into amenities (name, category) values
  ('Wi-Fi de alta velocidade', 'conectividade'),
  ('Café da manhã incluso', 'alimentacao'),
  ('Lareira a lenha', 'conforto'),
  ('Banheira de imersão', 'conforto'),
  ('Piscina aquecida', 'lazer'),
  ('Estacionamento gratuito', 'servicos'),
  ('Aceita pets', 'politicas'),
  ('Ar-condicionado', 'conforto'),
  ('Vista para o vale', 'diferenciais'),
  ('Serviço de quarto', 'servicos'),
  ('Spa & massagem', 'lazer'),
  ('Trilhas guiadas', 'experiencias')
on conflict (name) do nothing;
