-- Permite registrar reprovação com motivo operacional fora do fluxo público.
alter type pousada_status add value if not exists 'reprovada';
