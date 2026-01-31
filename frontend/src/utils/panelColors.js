// Panel color schemes for visual differentiation
const PANEL_COLORS = [
  {
    gradient: 'from-blue-600 to-blue-700',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    name: 'Blue'
  },
  {
    gradient: 'from-purple-600 to-purple-700',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-300',
    name: 'Purple'
  },
  {
    gradient: 'from-emerald-600 to-emerald-700',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    name: 'Green'
  },
  {
    gradient: 'from-orange-600 to-orange-700',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    name: 'Orange'
  },
  {
    gradient: 'from-rose-600 to-rose-700',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
    name: 'Rose'
  },
  {
    gradient: 'from-cyan-600 to-cyan-700',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-300',
    name: 'Cyan'
  },
];

export const getPanelColor = (panelIndex = 0) => {
  // Cycle through colors if there are more panels than colors
  const index = panelIndex % PANEL_COLORS.length;
  return PANEL_COLORS[index];
};

export const getPanelGradient = (panelIndex = 0) => {
  return getPanelColor(panelIndex).gradient;
};

export const getPanelBg = (panelIndex = 0) => {
  return getPanelColor(panelIndex).bg;
};

export const getPanelText = (panelIndex = 0) => {
  return getPanelColor(panelIndex).text;
};

export const getPanelBorder = (panelIndex = 0) => {
  return getPanelColor(panelIndex).border;
};
