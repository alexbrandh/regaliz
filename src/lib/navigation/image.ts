/**
 * next/image, behind one module.
 *
 * This is the hardest import to replace when leaving Next: nothing in React
 * Router optimises images for you, so the port has to decide what to do with
 * each prop rather than swap a name. Re-exported here so that decision
 * happens once, in this file.
 *
 * What the app actually uses, and what it costs to leave Next:
 *
 *   fill (7 uses)        -> no equivalent. Becomes position:absolute + inset:0
 *                           + object-fit on a plain <img>, and the parent
 *                           needs position:relative. The most invasive one.
 *   sizes (4)            -> keep as-is; plain <img> supports sizes with
 *                           srcset. Without srcset it does nothing.
 *   unoptimized (3)      -> drop it. Once there is no optimiser, every image
 *                           is unoptimised.
 *   placeholder (3)      -> no equivalent. Either drop the blur-up or
 *                           reimplement it with a background image.
 *   priority (2)         -> becomes <link rel="preload"> in the route head,
 *                           plus fetchpriority="high" on the tag.
 *   quality (1)          -> only meaningful with an optimiser. Drop, or move
 *                           the resizing to upload time in Supabase.
 *
 * width/height stay as they are and should be kept: they prevent layout
 * shift regardless of framework.
 */

export { default as Image } from 'next/image';
export type { ImageProps } from 'next/image';
