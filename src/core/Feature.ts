import { Registry } from './Registry';

export abstract class Feature {
  abstract readonly name: string;
  abstract register(registry: Registry): void;
}
