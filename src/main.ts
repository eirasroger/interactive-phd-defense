import '@/styles/base.css';
import '@/styles/stage.css';

import { createProgressIndicator } from '@/components/ProgressIndicator';
import { Presentation } from '@/engine/Presentation';
import { qualityTier } from '@/engine/env';
import { scenes } from '@/scenes';

const stage = document.querySelector<HTMLElement>('#stage');
if (!stage) throw new Error('Missing #stage element.');

document.documentElement.dataset['quality'] = qualityTier;

const presentation = new Presentation(stage, scenes);

const progress = createProgressIndicator();
document.body.appendChild(progress.element);
presentation.subscribe((state) => progress.update(state));

presentation.start();
