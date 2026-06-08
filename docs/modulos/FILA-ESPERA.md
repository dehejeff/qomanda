# Fila de espera por mesa (característica)

> Clientes esperam por uma mesa com determinada característica (🌊 vista praia,
> ⛰️ montanha, 🌅 varanda…). Quando uma mesa com a tag fica livre, o **próximo
> da fila** é avisado **no app** e tem um tempo de **tolerância** (configurado
> pelo restaurante) para ocupá-la.

## Decisões (fechadas)
- **Notificar:** o **próximo da fila** (fila justa, um a um). Se estourar a
  tolerância → expira e chama o próximo.
- **Cadastro:** **cliente** (autoatendimento na página do restaurante) **e**
  **anfitrião/garçom** (walk-in na portaria).
- **Critério:** por **característica/tag** reaproveitável (lista por restaurante).
- **Tolerância:** configurada **pelo restaurante** (minutos).
- **Sentar:** **anfitrião** marca "Sentou" (abre a sessão) **ou** o **cliente
  escaneia o QR** da mesa liberada (check-in normal encerra a espera).
- **Canal de aviso:** **somente in-app** (sem WhatsApp/template Meta nesta v1).
  O WhatsApp é guardado só como referência para a equipe.
- **Escopo:** vale para qualquer mesa com tag (salão e balcão). O gatilho é
  "mesa fica livre"; no balcão é preciso cadastrar lugares específicos como
  mesas (o `BALCAO` único compartilhado não tem ciclo livre/ocupado por assento).

## Modelo de dados (`supabase/migrate-table-waitlist.sql`)
- `restaurants.waitlist_tolerance_minutes` (int, default 10).
- `table_features` — tags por restaurante (`name`, `emoji`).
- `table_feature_map` — N:N entre `tables` e `table_features`.
- `table_waitlist` — fila: `feature_id`, `customer_id?`, `name`, `whatsapp?`,
  `party_size`, `status` (waiting/notified/seated/expired/cancelled), `source`
  (customer/staff), `notified_table_id`, `notified_at`, `expires_at`,
  `seated_session_id`.

**RLS / PII:** `table_features` e `table_feature_map` têm leitura pública (o
cliente vê as tags) e escrita do dono. `table_waitlist` guarda PII (nome/zap) —
**sem leitura pública**: todas as operações passam por **rotas server (admin)**;
o status do cliente é por **polling** de uma rota (sem expor a fila inteira).

## Fluxo de notificação (fila justa + tolerância)
1. Mesa com a tag fica **livre** (sessão fechada) → `notifyWaitlistOnTableFree(tableId)`.
2. Pega o próximo `waiting` da tag → marca `notified`, grava `notified_table_id`
   + `expires_at = agora + tolerância` → cliente vê o aviso (banner + som +
   contagem) na página de status.
3. Ocupou na tolerância → `seated`. Estourou → `expired` → chama o próximo.
4. **Expiração preguiçosa** (sem cron): reavaliada quando outra mesa libera,
   quando a equipe abre a fila e por um poll leve na tela — funciona no Hobby.

## Pontos de gatilho (mesa libera)
Centralizar em `notifyWaitlistOnTableFree(tableId)`, chamado onde a sessão
fecha: `close-session-if-settled` (pagamento) e fluxo do garçom
(`requestWaiterSessionClose`).

## Fases
1. **Migração + características** — tags + atribuição às mesas + tolerância (admin).
2. **Fila + matching + tolerância** — entrar/cancelar/status (cliente) + notificar
   próximo ao liberar.
3. **Equipe** (`/garcom/fila`) + **status in-app do cliente** (banner/som/contagem).

## Arquivos
- `migrate-table-waitlist.sql` (+ `check-migrations.sql`, ROADMAP).
- `src/lib/waitlist.ts` (matching, notificar próximo, expirar).
- Hook no fechamento de sessão → `notifyWaitlistOnTableFree`.
- Rotas: `/api/dashboard/table-features` (admin); `/api/customer/waitlist`
  (entrar/cancelar/status); `/api/dashboard/waitlist` (equipe).
- Telas: seção de características na **Mesas**; `/{slug}/fila` (cliente);
  `/garcom/fila` (equipe).
