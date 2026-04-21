/** Brand logo — image from `/public/crednova-logo.png` (Vite serves `public/` at site root). */
export const CREDNOVA_LOGO_SRC = "/crednova-logo.png";

type Props = {
  className?: string;
  /** Accessible label; logo is decorative next to wordmark in most layouts */
  alt?: string;
};

export function CredNovaMark({ className, alt = "CredNova" }: Props) {
  return (
    <img
      src={CREDNOVA_LOGO_SRC}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
