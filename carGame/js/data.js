// Game data constants extracted from script.js
// Exported for reuse across modules

export const PARTS = [
  // Engine system (split)
  { key: 'engine_block', name: 'Engine Block', basePrice: 4000 },
  { key: 'induction', name: 'Induction (Turbo/Intake)', basePrice: 1500 },
  { key: 'fuel_system', name: 'Fuel System', basePrice: 800 },
  { key: 'cooling', name: 'Cooling (Radiator/Pump)', basePrice: 600 },
  { key: 'ignition', name: 'Ignition (Coils/Plugs)', basePrice: 300 },
  { key: 'timing', name: 'Timing (Belt/Chain)', basePrice: 700 },
  { key: 'alternator', name: 'Alternator', basePrice: 350 },
  { key: 'ecu', name: 'ECU/Sensors', basePrice: 900 },
  // Drivetrain
  { key: 'transmission', name: 'Transmission', basePrice: 2500 },
  { key: 'clutch', name: 'Clutch', basePrice: 700 },
  { key: 'differential', name: 'Differential', basePrice: 1200 },
  // Running gear
  { key: 'suspension', name: 'Suspension', basePrice: 1000 },
  { key: 'tires', name: 'Tires', basePrice: 800 },
  { key: 'brakes', name: 'Brakes', basePrice: 600 },
  // Other
  { key: 'exhaust', name: 'Exhaust', basePrice: 900 },
  { key: 'battery', name: 'Battery', basePrice: 200 },
  { key: 'electronics', name: 'Interior Electronics', basePrice: 600 },
];

export const MODELS = [
  // Existing fictional/global set
  { model: 'Cobra GT', basePrice: 18000, perf: 80 },
  { model: 'Veloce RS', basePrice: 24000, perf: 88 },
  { model: 'Sakura Sport', basePrice: 14000, perf: 72 },
  { model: 'Highland 4x4', basePrice: 16000, perf: 65 },
  { model: 'Sting S', basePrice: 30000, perf: 95 },
  { model: 'Metro Hatch', basePrice: 8000, perf: 50 },
  { model: 'Silver Arrow', basePrice: 22000, perf: 78 },
  { model: 'Comet R', basePrice: 28000, perf: 90 },
  { model: 'Falcon V6', basePrice: 12000, perf: 62 },
  { model: 'Zephyr Coupe', basePrice: 20000, perf: 75 },

  // JDM additions (well‑known enthusiast models)
  { model: 'Nissan Skyline GT-R R34', basePrice: 65000, perf: 98 },
  { model: 'Toyota Supra Mk4 (A80)', basePrice: 52000, perf: 92 },
  { model: 'Mazda RX-7 (FD3S)', basePrice: 38000, perf: 88 },
  { model: 'Honda NSX (NA2)', basePrice: 90000, perf: 96 },
  { model: 'Mitsubishi Lancer Evo VI', basePrice: 32000, perf: 86 },
  { model: 'Subaru Impreza WRX STI (GC8)', basePrice: 28000, perf: 84 },
  { model: 'Nissan Silvia (S15)', basePrice: 26000, perf: 82 },
  { model: 'Toyota AE86 Trueno', basePrice: 18000, perf: 70 },
  { model: 'Honda S2000 (AP2)', basePrice: 30000, perf: 85 },
  { model: 'Nissan 300ZX (Z32)', basePrice: 22000, perf: 78 },
  { model: 'Toyota Chaser (JZX100)', basePrice: 26000, perf: 80 },
  { model: 'Toyota Aristo V300 (JZS161)', basePrice: 24000, perf: 76 },
];

