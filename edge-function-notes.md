# Production money + LIVE integrations

Do not put provider secrets in React.

## M-Pesa
Create a Supabase Edge Function such as `mpesa-payment` and keep:
- consumer key
- consumer secret
- shortcode
- passkey
- callback credentials

in Supabase project secrets.

The browser should call the Edge Function. The Edge Function should:
1. Validate the authenticated user.
2. Validate amount and reference.
3. Initiate payment with the provider.
4. Verify the callback/server response.
5. Credit coins only after confirmed payment.
6. Write an immutable wallet transaction.

## Withdrawals
A withdrawal must never simply mark itself as paid from the browser.
Admin approval should create a secure server-side payout request.
The payout result should be verified and recorded with `provider_reference`.

## LIVE
Use a provider such as LiveKit or Agora.
The browser asks your secure backend for a short-lived room token.
The secret API key never reaches the browser.
Store provider room IDs in `live_streams.provider_room_id`.

## Gifts
A gift flow should be a server transaction:
- Verify sender owns enough coins.
- Deduct coins atomically.
- Create `tips` record.
- Credit creator earnings.
- Record platform fee.
Never trust coin balances supplied by the browser.
