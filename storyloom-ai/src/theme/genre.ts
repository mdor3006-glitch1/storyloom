export interface GenreMeta {
  primary:   string;
  secondary: string;
  icon:      string;
  gradient:  [string, string];
  plusOnly:  boolean;
}

export const GENRE_META: Record<string, GenreMeta> = {
  Romance:                { primary: '#FF69B4', secondary: '#9C27B0', icon: '💕', gradient: ['#FF69B4', '#9C27B0'], plusOnly: false },
  Thriller:               { primary: '#8B0000', secondary: '#1a1a1a', icon: '🔪', gradient: ['#8B0000', '#1a1a1a'], plusOnly: false },
  Fantasy:                { primary: '#FFD700', secondary: '#4A0080', icon: '🧙', gradient: ['#FFD700', '#1a0050'], plusOnly: false },
  Horror:                 { primary: '#1B5E20', secondary: '#000000', icon: '👻', gradient: ['#1B5E20', '#000000'], plusOnly: false },
  Comedy:                 { primary: '#FFD700', secondary: '#FF6B35', icon: '😂', gradient: ['#FFD700', '#FF6B35'], plusOnly: false },
  'Sci-Fi':               { primary: '#00E5FF', secondary: '#0a0a2e', icon: '🚀', gradient: ['#00E5FF', '#0a0a2e'], plusOnly: false },
  Drama:                  { primary: '#1565C0', secondary: '#0d0d1a', icon: '🎬', gradient: ['#1565C0', '#0d0d1a'], plusOnly: false },
  'Cartoon Characters':   { primary: '#FF8F00', secondary: '#E91E63', icon: '🍌', gradient: ['#FF8F00', '#E91E63'], plusOnly: false },
  'Dark Romance':         { primary: '#8B0050', secondary: '#1a0010', icon: '🥀', gradient: ['#8B0050', '#1a0010'], plusOnly: true  },
  'Psychological Thriller':{ primary: '#4A0080', secondary: '#0d0d0d', icon: '🧠', gradient: ['#4A0080', '#0d0d0d'], plusOnly: true  },
  'Epic Fantasy':         { primary: '#B8860B', secondary: '#1a0a3e', icon: '⚔️', gradient: ['#B8860B', '#1a0a3e'], plusOnly: true  },
  'Cosmic Horror':        { primary: '#003366', secondary: '#000000', icon: '🌀', gradient: ['#003366', '#000000'], plusOnly: true  },
  default:                { primary: '#1db954', secondary: '#048A81', icon: '📖', gradient: ['#1db954', '#048A81'], plusOnly: false },
};

export function getGenreMeta(genre: string | undefined): GenreMeta {
  return GENRE_META[genre ?? ''] ?? GENRE_META.default;
}
