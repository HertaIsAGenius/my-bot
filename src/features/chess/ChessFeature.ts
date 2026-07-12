import { Feature } from '../../core/Feature';
import { Registry } from '../../core/Registry';

const chessCmd: any = require('../../commands/chess');

export class ChessFeature extends Feature {
  readonly name = 'chess';

  register(registry: Registry): void {
    registry.registerButton(/^chess_/, (i) => chessCmd.handleChessButton(i));
  }
}
