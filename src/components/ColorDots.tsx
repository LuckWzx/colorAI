/** CMYK 四色圆点组：品牌标识性小元素，用于 eyebrow 等场景 */
export default function ColorDots({
  size = 8,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const dots = ['#0E6F9C', '#E4007E', '#FFD200', '#26323B'];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-hidden="true">
      {dots.map((c) => (
        <span
          key={c}
          className="rounded-full shrink-0"
          style={{ width: size, height: size, backgroundColor: c }}
        />
      ))}
    </span>
  );
}
