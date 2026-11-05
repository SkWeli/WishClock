import { house } from './house.js';
import { car } from './car.js';
import { wedding } from './wedding.js';
import { rent } from './rent.js';
import { custom } from './custom.js';
import { prune } from '../engine/costTree.js';

/** Every goal type. To add one (a trip, education, a business), write a module and list it here. */
export const MODULES = { wedding, rent, house, car, custom };

/** Turn a saved goal ({ id, kind, name, options }) into what the simulation needs. */
export function buildGoal(goal) {
  const mod = MODULES[goal.kind];
  const options = { ...mod.defaults(), ...goal.options };
  const built = mod.build(options, goal);
  return {
    ...goal,
    verb: mod.verb || 'Buy',
    options,
    tree: prune(built.tree) ?? { label: goal.name, children: [] },
    running: built.running ? prune(built.running) : null,
    financing: built.financing,
    warnings: built.warnings,
    refundToday: built.refundToday || 0,
    endsKinds: built.endsKinds || [],
  };
}
