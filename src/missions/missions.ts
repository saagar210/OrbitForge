import type { Mission } from "./MissionDefinition";

export const MISSIONS: Mission[] = [
  {
    id: "reach_mars",
    name: "Reach Mars",
    description: "Launch a spacecraft from Earth orbit and reach Mars orbit using thrust.",
    scenarioId: "inner_solar",
    objectives: [
      {
        type: "reach_orbit",
        description: "Reach Mars orbit (400 units from Sun)",
        targetRadius: 400,
        threshold: 40,
      },
    ],
    timeLimit: 30000,
  },
  {
    id: "hohmann_transfer",
    name: "Hohmann Transfer",
    description: "Perform a fuel-efficient Hohmann transfer from Earth to Jupiter orbit.",
    scenarioId: "full_solar",
    objectives: [
      {
        type: "reach_orbit",
        description: "Reach Jupiter orbit (500 units from Sun)",
        targetRadius: 500,
        threshold: 50,
      },
    ],
    timeLimit: 50000,
  },
  {
    id: "gravity_slingshot",
    name: "Gravity Slingshot",
    description: "Use Jupiter's gravity to reach a speed of 30 units/tick.",
    scenarioId: "full_solar",
    objectives: [
      {
        type: "reach_body",
        description: "Fly close to Jupiter",
        targetBodyName: "Jupiter",
        threshold: 100,
      },
      {
        type: "achieve_speed",
        description: "Reach speed of 30 units/tick",
        minSpeed: 30,
      },
    ],
    timeLimit: 60000,
  },
  {
    id: "binary_orbit",
    name: "Binary Orbit",
    description: "Establish a stable orbit around the binary star system's barycenter.",
    scenarioId: "binary_star",
    objectives: [
      {
        type: "survive_time",
        description: "Maintain orbit for 5000 ticks",
        requiredTicks: 5000,
      },
    ],
  },
];
