// Built-in offline question bank. Final fallback so Papple ALWAYS has questions —
// works with zero setup (no API key, no Ollama, no internet). Questions drawn
// from chica's Honors Chem + Alg2/Trig Sem 2 review material.

export const STARTER_QUESTIONS = [
  { id: "starter-1", deck: "starter", topic: "Gas Laws", source: "starter", type: "mc",
    question: "At STP, what volume does 1 mole of any ideal gas occupy?",
    options: ["11.2 L", "22.4 L", "24.0 L", "1.0 L"], answerIndex: 1,
    explanation: "At STP, 1 mol of any ideal gas = 22.4 L." },
  { id: "starter-2", deck: "starter", topic: "Bonding", source: "starter", type: "mc",
    question: "What type of bonding holds KCl together?",
    options: ["Covalent", "Ionic", "Metallic", "Hydrogen"], answerIndex: 1,
    explanation: "A metal (K) + a nonmetal (Cl) transfer electrons → ionic bonding." },
  { id: "starter-3", deck: "starter", topic: "Nomenclature", source: "starter", type: "mc",
    question: "What is the correct name for FeCl₃?",
    options: ["Iron(II) chloride", "Iron(III) chloride", "Iron trichloride", "Ferrous chloride"], answerIndex: 1,
    explanation: "Three Cl⁻ means Fe must be +3, so it's Iron(III) chloride." },
  { id: "starter-4", deck: "starter", topic: "Reaction Types", source: "starter", type: "mc",
    question: "CH₄ + 2O₂ → CO₂ + 2H₂O is what type of reaction?",
    options: ["Synthesis", "Combustion", "Decomposition", "Single replacement"], answerIndex: 1,
    explanation: "A hydrocarbon burning in O₂ to give CO₂ + H₂O is combustion." },
  { id: "starter-5", deck: "starter", topic: "Solutions", source: "starter", type: "typed",
    question: "Write the formula for molarity (M) in words.",
    answer: "moles of solute / liters of solution",
    explanation: "M = moles of solute ÷ liters of solution." },
  { id: "starter-6", deck: "starter", topic: "Thermochemistry", source: "starter", type: "mc",
    question: "The specific heat of liquid water is closest to which value?",
    options: ["0.5 J/g°C", "2.0 J/g°C", "4.184 J/g°C", "540 J/g°C"], answerIndex: 2,
    explanation: "Water's specific heat is 4.184 J/g°C (1.0 cal/g°C)." },
  { id: "starter-7", deck: "starter", topic: "Equilibrium", source: "starter", type: "mc",
    question: "For an exothermic reaction at equilibrium, increasing the temperature shifts it…",
    options: ["to the right", "to the left", "no change", "it stops reacting"], answerIndex: 1,
    explanation: "Heat is a product of an exothermic reaction; adding heat shifts it left (Le Chatelier)." },
  { id: "starter-8", deck: "starter", topic: "Acids & Bases", source: "starter", type: "typed",
    question: "What is the pH of 0.45 M HCl? (round to 2 decimal places)",
    answer: "0.35",
    explanation: "pH = −log(0.45) ≈ 0.35." },
  { id: "starter-9", deck: "starter", topic: "Reaction Rate", source: "starter", type: "mc",
    question: "Collision theory says reacting particles must collide with enough energy AND…",
    options: ["the right color", "the correct orientation", "a catalyst present", "equal mass"], answerIndex: 1,
    explanation: "Effective collisions require sufficient energy and the correct orientation." },
  { id: "starter-10", deck: "starter", topic: "Solubility", source: "starter", type: "mc",
    question: "Which of these compounds is INSOLUBLE in water?",
    options: ["NaCl", "KNO₃", "AgCl", "NH₄Cl"], answerIndex: 2,
    explanation: "Most chlorides are soluble except Ag⁺, Pb²⁺, Hg₂²⁺ — so AgCl is insoluble." },
  { id: "starter-11", deck: "starter", topic: "Rational Functions", source: "starter", type: "mc",
    question: "What is the horizontal asymptote of f(x) = x²/(x²−16)?",
    options: ["y = 0", "y = 1", "y = 16", "no horizontal asymptote"], answerIndex: 1,
    explanation: "Numerator and denominator have equal degree → HA = ratio of leading coefficients = 1." },
  { id: "starter-12", deck: "starter", topic: "Trig — Radians", source: "starter", type: "mc",
    question: "Convert 7π/10 radians to degrees.",
    options: ["120°", "126°", "140°", "70°"], answerIndex: 1,
    explanation: "7π/10 × 180/π = 126°." },
  { id: "starter-13", deck: "starter", topic: "Rational Exponents", source: "starter", type: "typed",
    question: "Evaluate 27^(4/3).",
    answer: "81",
    explanation: "27^(1/3) = 3, and 3⁴ = 81." },
  { id: "starter-14", deck: "starter", topic: "Logarithms", source: "starter", type: "mc",
    question: "Evaluate log₁₂(144).",
    options: ["1", "2", "12", "11"], answerIndex: 1,
    explanation: "12² = 144, so log₁₂(144) = 2." },
  { id: "starter-15", deck: "starter", topic: "Trig Graphs", source: "starter", type: "mc",
    question: "What is the period of y = sin(2x)?",
    options: ["π/2", "π", "2π", "4π"], answerIndex: 1,
    explanation: "Period = 2π/|B| = 2π/2 = π." },
  { id: "starter-16", deck: "starter", topic: "Unit Circle", source: "starter", type: "typed",
    question: "What is the reference angle for θ = 9π/5?",
    answer: "π/5",
    explanation: "9π/5 is in Quadrant IV; 2π − 9π/5 = π/5." }
];

// Return up to `count` starter questions matching the answer mode, shuffled.
export function starterBatch(count, answerMode = "both") {
  let pool = STARTER_QUESTIONS;
  if (answerMode === "mc") pool = pool.filter(q => q.type === "mc");
  else if (answerMode === "typed") pool = pool.filter(q => q.type === "typed");
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(q => ({ ...q }));
}
