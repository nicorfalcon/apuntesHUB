interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}

export function StarRating({ rating, count, size = "sm" }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  // Sin reseñas: no mostramos 5 estrellas vacías (se lee como "mal valorado").
  // Solo cuando el llamador pasa count === 0 de forma explícita.
  if (count === 0) {
    return (
      <span
        className={`text-gray-400 dark:text-sand-300/60 ${
          size === "sm" ? "text-xs" : "text-sm"
        }`}
      >
        Sin reseñas
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {stars.map((star) => {
          const fill = Math.min(Math.max(rating - star + 1, 0), 1);
          return (
            <svg key={star} className={`${iconSize} text-amber-400`} viewBox="0 0 20 20">
              <defs>
                <linearGradient id={`star-${star}-${rating}`}>
                  <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                  <stop offset={`${fill * 100}%`} stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                fill={fill === 1 ? "currentColor" : fill === 0 ? "none" : `url(#star-${star}-${rating})`}
                stroke="currentColor"
                strokeWidth={fill === 0 ? 1.5 : 0}
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              />
            </svg>
          );
        })}
      </div>
      {rating > 0 && (
        <span className={`font-medium text-foreground ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {rating.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className={`text-gray-400 ${size === "sm" ? "text-xs" : "text-sm"}`}>
          ({count} {count === 1 ? "reseña" : "reseñas"})
        </span>
      )}
    </div>
  );
}
