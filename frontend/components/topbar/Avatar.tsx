// frontend/components/topbar/Avatar.tsx
//
// Gradient initials avatar (PH24). Initials are derived from the username so the
// chip stays meaningful without an uploaded image (Profile & Avatar is a stub).

interface AvatarProps {
  name: string;
  size?: number;
  ring?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 30, ring = false }: AvatarProps) {
  return (
    <div
      className="cc-av"
      data-ring={ring ? "1" : undefined}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
