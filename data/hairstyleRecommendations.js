// Curated Hairstyle Recommendations & Styling Domain Knowledge

const HAIRSTYLE_RECOMMENDATIONS = {
  oval: {
    description: "Oval face shape is considered the most balanced — forehead, cheekbones, and jaw are close to equal width, with a length somewhat longer than the width. Most hairstyles suit this shape.",
    styling_principle: "Maintain natural balance — avoid styles that add excessive height or width, since proportions are already even.",
    women: [
      "Long layers with soft waves",
      "Blunt bob (chin-length or shoulder-length)",
      "Sleek high ponytail",
      "Curtain bangs / fringe",
      "Pixie cut (oval faces carry short cuts especially well)",
    ],
    men: [
      "Classic side part",
      "Crew cut",
      "Textured quiff",
      "Slicked-back undercut",
      "Buzz cut",
    ],
    avoid: [
      "Heavy, blunt bangs that shorten the face excessively",
      "Styles that add too much height on top",
    ],
  },

  round: {
    description: "Round face shape has soft curves with similar width and length, full cheeks, and a rounded jawline with no sharp angles.",
    styling_principle: "Add height at the crown and length/angles to visually elongate the face; avoid width at cheekbone level.",
    women: [
      "Long layered cuts past the shoulders",
      "High volume at the crown with a side part",
      "Asymmetrical bob (longer on one side)",
      "Long side-swept bangs",
      "Voluminous top with tapered sides",
    ],
    men: [
      "Pompadour (height at the crown)",
      "Faux hawk",
      "Textured crop with volume on top",
      "Undercut with longer top",
      "Angular fringe",
    ],
    avoid: [
      "Chin-length blunt bobs (emphasizes roundness)",
      "Center parts with no volume",
      "Full rounded fringes",
    ],
  },

  square: {
    description: "Square face shape has a strong, angular jawline, broad forehead, and minimal curve — width at forehead, cheekbone, and jaw is similar.",
    styling_principle: "Soften the strong jawline with layers, waves, or rounded silhouettes; avoid styles that add sharp width.",
    women: [
      "Soft layered waves starting at cheekbone",
      "Side-swept fringe",
      "Long layers that fall past the jaw",
      "Textured lob with soft ends",
      "Curly or wavy shoulder-length cuts",
    ],
    men: [
      "Textured crop with soft, tousled top",
      "Side part with soft fringe",
      "Medium-length waves",
      "Fade with longer, textured top",
    ],
    avoid: [
      "Blunt, straight-across bangs",
      "Chin-length bobs that end right at the jaw",
    ],
  },

  heart: {
    description: "Heart face shape is wider at the forehead and cheekbones, tapering down to a narrow, pointed chin.",
    styling_principle: "Balance the wider forehead by adding volume around the jawline and chin; avoid heavy crown volume.",
    women: [
      "Chin-length bob with soft curls",
      "Side-parted shoulder-length waves",
      "Long layers starting below the chin",
      "Curtain bangs framing the eyes",
      "Deep side part",
    ],
    men: [
      "Mid-length textured hair with volume at chin/jaw",
      "Side-swept quiff",
      "Classic pompadour with soft sides",
      "Slicked-back style",
    ],
    avoid: [
      "Slicked-back high ponytails with no face-framing pieces",
      "Short crop cuts that widen forehead",
    ],
  },

  oblong: {
    description: "Oblong / Rectangular face shape is noticeably longer than it is wide, with a straight cheek-to-jawline profile.",
    styling_principle: "Add width at cheekbones and soft volume at the sides to break up length; avoid tall hairstyles.",
    women: [
      "Shoulder-length cut with voluminous side waves",
      "Full forehead-covering bangs",
      "Chin-length bob with texture",
      "Wide curly styles",
    ],
    men: [
      "Side part with medium length on sides",
      "Clean ivy league cut",
      "Fringe brushed to the side",
      "Classic scissor cut",
    ],
    avoid: [
      "High pompadours or sky-high quiffs",
      "Very short shaved sides with long top",
    ],
  },
};

module.exports = HAIRSTYLE_RECOMMENDATIONS;
