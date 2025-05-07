import React from 'react';

interface HexagonTileProps {
  x: number; // Center x of the hexagon
  y: number; // Center y of the hexagon
  size: number; // Size from center to a corner
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  onClick?: () => void;
  id?: string; // Optional ID for the hexagon (e.g., layer-point)
  className?: string; // Optional className for styling
}

const HexagonTile: React.FC<HexagonTileProps> = ({
  x,
  y,
  size,
  fillColor = '#666', // Default fill color
  strokeColor = '#333', // Default stroke color
  strokeWidth = 0.5,    // Default stroke width, adjust as needed
  onClick,
  id,
  className
}) => {
  // Calculate the 6 points of the hexagon relative to its center (x, y)
  // Hexagons are typically point-topped or flat-topped. Let's assume point-topped for now.
  // For a point-topped hexagon:
  // Point 0 (top): (x, y - size)
  // Point 1: (x + size * sqrt(3)/2, y - size/2)
  // Point 2: (x + size * sqrt(3)/2, y + size/2)
  // Point 3 (bottom): (x, y + size)
  // Point 4: (x - size * sqrt(3)/2, y + size/2)
  // Point 5: (x - size * sqrt(3)/2, y - size/2)

  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30; // Start at -30 deg for point-topped (flat side up is 0 deg for first point)
    // If we want flat-topped, start angle_deg = 60 * i
    const angle_rad = Math.PI / 180 * angle_deg;
    points.push(
      `${x + size * Math.cos(angle_rad)},${y + size * Math.sin(angle_rad)}`
    );
  }
  const pointsString = points.join(' ');

  return (
    <polygon
      id={id}
      className={`hexagon-tile ${className || ''}`.trim()}
      points={pointsString}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    />
  );
};

export default HexagonTile; 