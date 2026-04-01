import { CheckIcon } from '@heroicons/react/24/solid';
import { useLanguage } from '@/context/LanguageContext';

type SetupFlowStepperProps = {
  currentStep: number;
};

export default function SetupFlowStepper({ currentStep }: SetupFlowStepperProps) {
  const { t } = useLanguage();
  const stepTx = t('setup_flow.steps');
  const steps = [
    { title: stepTx.property_title, description: stepTx.property_desc },
    { title: stepTx.unit_title, description: stepTx.unit_desc },
    { title: stepTx.tenant_title, description: stepTx.tenant_desc },
    { title: stepTx.payment_title, description: stepTx.payment_desc },
  ];

  return (
    <div className="rounded-2xl border border-brand-200 bg-white/70 p-4 shadow-sm dark:border-brand-800 dark:bg-brand-900/70">
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.title} className="flex min-w-[165px] items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
                  isCompleted
                    ? 'border-success bg-success text-white'
                    : isCurrent
                      ? 'border-primary bg-primary text-white'
                      : 'border-brand-200 bg-brand-50 text-brand-500 dark:border-brand-700 dark:bg-brand-800'
                }`}
              >
                {isCompleted ? <CheckIcon className="h-5 w-5" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-brand-900 dark:text-white'}`}>
                  {step.title}
                </p>
                <p className="text-xs text-brand-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`hidden h-px flex-1 md:block ${index < currentStep ? 'bg-success' : 'bg-brand-200 dark:bg-brand-700'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
