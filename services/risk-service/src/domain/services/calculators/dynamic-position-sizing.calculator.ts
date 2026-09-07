import { ProposedTrade } from '../../interfaces/calculation-inputs.interface';
import { PositionSize } from '../../entities/position-size.value-object';

export class DynamicPositionSizingCalculator {
  public static calculate(
    trade: ProposedTrade,
    riskScore: number
  ): { permittedSize: PositionSize | null; decisionOutcome: 'APPROVED' | 'MODIFIED' | 'REJECTED' } {
    let permittedSizeValue = 0;
    let decisionOutcome: 'APPROVED' | 'MODIFIED' | 'REJECTED' = 'APPROVED';

    if (riskScore > 80) {
      permittedSizeValue = 0;
      decisionOutcome = 'REJECTED';
    } else if (riskScore > 60) {
      permittedSizeValue = trade.size * 0.5;
      decisionOutcome = 'MODIFIED';
    } else {
      permittedSizeValue = trade.size;
      decisionOutcome = 'APPROVED';
    }

    const permittedSize = permittedSizeValue > 0 ? PositionSize.create(permittedSizeValue) : null;

    return { permittedSize, decisionOutcome };
  }
}
