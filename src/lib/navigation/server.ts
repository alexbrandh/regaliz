/**
 * Server-side navigation control flow, behind one module.
 *
 * Both of these work by throwing: they unwind the render rather than
 * returning. Never call them inside a try/catch that swallows errors — see
 * the note in src/app/share/[postcardId]/page.tsx for what that costs.
 *
 * React Router equivalents, for the port:
 *
 *   redirect(path)  -> throw redirect(path)        from 'react-router'
 *   notFound()      -> throw new Response(null, {status: 404})
 *
 * React Router's redirect() returns a Response you throw yourself, so the
 * `throw` becomes explicit at the call site. That is the one shape change.
 */

export { redirect, notFound, permanentRedirect } from 'next/navigation';
