import React from 'react';
import { InputField } from './InputField';
import { Card } from './Card';
import { nhgFee } from '../common/constants';
import { BANK_GUARANTEE_RATE, TRANSFER_TAX_RATE } from '../common/Formulas';
import { glossary } from '../common/glossary';
import { ToggleableCost } from '../App';

type Props = {
  price: number;
  savings: number;
  loan: number;
  notary: number;
  valuation: number;
  financialAdvisor: number;
  realStateAgent: number;
  structuralSurvey: number;
  costEnabled: Record<ToggleableCost, boolean>;
  onChange: (field: string, value: number) => void;
  onToggle: (field: ToggleableCost, enabled: boolean) => void;
};

export function Costs(props: Props) {
  // Shown at full value even when switched off, so you can see what you are
  // excluding; `calgulateLoanFigures` is what actually drops it from the total.
  const bankGuarantee = BANK_GUARANTEE_RATE * props.price;
  const transferTax = TRANSFER_TAX_RATE * props.price;
  const nhg = nhgFee(props.price, props.loan);

  function toggle(field: ToggleableCost) {
    return {
      checked: props.costEnabled[field],
      onChange: (checked: boolean) => props.onToggle(field, checked),
    };
  }

  return (
    <Card title="Purchase costs">
      <InputField title="Transfer tax" prepend="€" disabled value={transferTax} toggle={toggle('transferTax')} onChange={() => {}} info={glossary.transferTax} />
      <InputField
        title="Valuation"
        prepend="€"
        value={props.valuation}
        toggle={toggle('valuation')}
        onChange={(value) => props.onChange('valuation', parseFloat(value))}
      />
      <InputField
        title="Real estate agent"
        prepend="€"
        value={props.realStateAgent}
        toggle={toggle('realStateAgent')}
        onChange={(value) => props.onChange('realStateAgent', parseFloat(value))}
      />
      <InputField title="Bank guarantee" prepend="€" disabled value={bankGuarantee} toggle={toggle('bankGuarantee')} onChange={() => {}} info={glossary.bankGuarantee} />
      <InputField
        title="Notary"
        prepend="€"
        value={props.notary}
        toggle={toggle('notary')}
        onChange={(value) => props.onChange('notary', parseFloat(value))}
      />
      <InputField
        title="Financial advisor"
        prepend="€"
        value={props.financialAdvisor}
        toggle={toggle('financialAdvisor')}
        onChange={(value) => props.onChange('financialAdvisor', parseFloat(value))}
      />
      <InputField title="NHG" prepend="€" disabled value={nhg} toggle={toggle('nhg')} onChange={() => {}} info={glossary.nhg} />
      <InputField
        title="Structural survey"
        prepend="€"
        value={props.structuralSurvey}
        toggle={toggle('structuralSurvey')}
        onChange={(value) => props.onChange('structuralSurvey', parseFloat(value))}
      />
    </Card>
  );
}
