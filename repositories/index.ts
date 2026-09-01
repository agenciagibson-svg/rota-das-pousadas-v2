// Repositories — a única camada que acessa o banco/Supabase.
// Consumidos exclusivamente pelos Services. Import via '@/repositories'.
export { getPousadaRepository, type PousadaRepository } from './pousadas.repository'
export { getDestinationRepository, type DestinationRepository } from './destinations.repository'
