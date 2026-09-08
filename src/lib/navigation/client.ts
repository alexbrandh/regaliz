'use client';

/**
 * Client-side navigation, behind one module.
 *
 * Everything the app needs from next/link and next/navigation is re-exported
 * here so the rest of the codebase never imports Next directly. When this app
 * moves to React Router, this file is what gets rewritten — not the 30+ call
 * sites.
 *
 * The React Router equivalents, so the rewrite is mechanical:
 *
 *   Link              -> Link from 'react-router'   (`href` becomes `to`)
 *   useRouter().push  -> useNavigate()(path)
 *   useRouter().replace -> useNavigate()(path, {replace: true})
 *   useRouter().back  -> useNavigate()(-1)
 *   useRouter().refresh -> useRevalidator().revalidate()
 *   usePathname       -> useLocation().pathname
 *   useSearchParams   -> useSearchParams()          (returns a tuple there)
 *   useParams         -> useParams()                (same name, same idea)
 *
 * Two of those change shape and are the ones to watch: `href` -> `to` on Link,
 * and useSearchParams returning [params, setParams] rather than params alone.
 */

export { default as Link } from 'next/link';
export type { LinkProps } from 'next/link';

export {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
} from 'next/navigation';
