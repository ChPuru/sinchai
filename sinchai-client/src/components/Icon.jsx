// Exp 3.1 - smallest possible props-driven component: Material Symbols icon
export default function Icon({ name, fill = false, size, className = "", style }) {
  return (
    <span className={"material-symbols-outlined " + (fill ? "fill " : "") + className} style={{ fontSize: size, ...style }} aria-hidden="true">
      {name}
    </span>
  );
}
