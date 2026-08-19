/**
 * C4 — inference. Data of record.
 *
 * The station argues a general operation and validates it on one attribute.
 * Everything about the operation (what a comparison needs, which features are
 * admissible, how a composition becomes a vector, how the two networks are
 * trained together) holds for any attribute that correlates with material
 * composition. Everything with a number attached to it is the end-of-life case
 * study, which is the attribute the model was built and measured on.
 *
 * Every quantity here is published in the C4 paper and `assertPublished`
 * checks the arithmetic that relates them. C2's corpus figures are a different
 * population and none of them is carried into this file.
 */

/* ---- Where the stage sits ------------------------------------------------ */

/**
 * What C3 hands on, and what happens to it here.
 *
 * The recommendation can be made as soon as the candidates are shortlisted.
 * Product declarations are rarely complete, so some of the attributes the
 * recommendation reads are missing for some of the candidates, and the
 * recommendation is then made on less evidence than it was designed for.
 * Material composition is declared by every product and it predicts several of
 * the attributes that go missing, so the missing values can be estimated before
 * the recommendation is made.
 */
export const STAGE = {
  upstream: 'Shortlisted candidates',
  downstream: 'Recommendation',
  operation: 'Inference',
} as const;

export interface Input {
  readonly key: string;
  readonly label: string;
}

/**
 * What the model reads for this attribute.
 *
 * The three named ones are what an end-of-life prediction needs. The fourth is
 * there because the operation is not tied to this attribute: a different target
 * reads whatever else the record reliably carries.
 */
export const INPUTS: readonly Input[] = [
  { key: 'composition', label: 'Material composition' },
  { key: 'origin', label: 'Circular origin' },
  { key: 'disassembly', label: 'Disassembly potential' },
  { key: 'others', label: 'and others' },
] as const;

/** How a value is held once the pipeline has both kinds. */
export type Provenance = 'declared' | 'inferred' | 'absent';

/** The attribute this contribution predicts, and the form the output takes. */
export const TARGET = {
  label: 'End-of-life circularity pathway',
  form: 'A probability distribution across eight pathways',
} as const;

/** The eight outputs, in the order the softmax layer holds them. */
export const PATHWAY_SET: readonly string[] = [
  'Reuse',
  'Reconditioning',
  'Composting',
  'Valorisation and filling',
  'Recycling',
  'Incineration',
  'Inert and non-hazardous landfill',
  'Hazardous waste',
] as const;

/* ---- Composition into a vector ------------------------------------------- */

export const WORD2VEC = {
  model: 'Word2Vec',
  dimensions: 300,
  vocabulary: 3_000_000,
  corpus: 'Google News, approximately 100 billion words',
  /** Cosine similarity above which two product compositions cluster together. */
  clusterAt: 0.8,
} as const;

export interface EmbeddingStep {
  readonly key: string;
  readonly label: string;
  readonly body: string;
}

/** Section 2.2 and Appendix B, in the order they are applied. */
export const EMBEDDING_STEPS: readonly EmbeddingStep[] = [
  { key: 'normalise', label: 'Term normalisation', body: 'One spelling per term' },
  { key: 'resolve', label: 'Synonym resolution', body: 'Trade names to standard terms' },
  { key: 'segment', label: 'Multi-word decomposition', body: 'Into semantic units' },
  { key: 'retrieve', label: 'Vector retrieval', body: '300 dimensions per term' },
  { key: 'material', label: 'Material embedding', body: 'Mean of its terms' },
  { key: 'product', label: 'Product embedding', body: 'Weighted sum of its materials' },
] as const;

export interface WorkedMaterial {
  readonly declared: string;
  /** Weight percentage within the product. */
  readonly weight: number;
  /** What the declared name decomposes into once normalised and segmented. */
  readonly terms: readonly string[];
}

/** Appendix B, verbatim. One product, two constituents, one of them composite. */
export const WORKED: readonly WorkedMaterial[] = [
  { declared: 'aluminium foil', weight: 75, terms: ['aluminum', 'foil'] },
  { declared: 'wood', weight: 25, terms: ['wood'] },
] as const;

/* ---- The architecture ----------------------------------------------------- */

export interface Stage {
  readonly key: string;
  readonly label: string;
  readonly units: number;
  readonly detail: string;
}

/**
 * The encoder, its mirror, and the head that reads the latent space.
 *
 * `units` is the width the drawing scales from, so the composition is the
 * network's own shape and nothing about it is chosen for appearance.
 */
export const ENCODER: readonly Stage[] = [
  { key: 'input', label: 'Product embedding', units: 300, detail: 'Weighted material vector' },
  { key: 'hidden', label: 'Dense', units: 128, detail: 'LeakyReLU, dropout' },
  { key: 'latent', label: 'Latent space', units: 50, detail: 'Linear projection' },
] as const;

export const DECODER: readonly Stage[] = [
  { key: 'latent', label: 'Latent space', units: 50, detail: 'Shared with the predictor' },
  { key: 'hidden', label: 'Dense', units: 128, detail: 'LeakyReLU, dropout' },
  { key: 'output', label: 'Reconstruction', units: 300, detail: 'Compared against the input' },
] as const;

export const SCALARS: readonly Stage[] = [
  { key: 'origin', label: 'Circular origin', units: 1, detail: 'Scaled to 0 through 1' },
  { key: 'disassembly', label: 'Disassembly potential', units: 1, detail: 'Scaled to 0 through 1' },
] as const;

export const PREDICTOR: readonly Stage[] = [
  {
    key: 'input',
    label: 'Latent space and scalars',
    units: 52,
    detail: 'Concatenated',
  },
  { key: 'hidden', label: 'Dense', units: 128, detail: 'Layer norm, LeakyReLU, dropout' },
  { key: 'output', label: 'Pathway distribution', units: 8, detail: 'Softmax' },
] as const;

export interface Objective {
  readonly key: 'prediction' | 'reconstruction';
  readonly label: string;
  readonly weight: number;
  readonly body: string;
}

/**
 * The two objectives, and the ratio between them.
 *
 * The weighting is what makes the latent space task-aware. Reconstruction is
 * held at a tenth so the encoder keeps enough of the input to be a faithful
 * compression while the geometry of the latent space is shaped by the
 * prediction it has to support.
 */
export const OBJECTIVES: readonly Objective[] = [
  {
    key: 'prediction',
    label: 'Prediction loss',
    weight: 1.0,
    body: 'Against the declared pathway',
  },
  {
    key: 'reconstruction',
    label: 'Reconstruction loss',
    weight: 0.1,
    body: 'Against the input embedding',
  },
] as const;

/** What the two weighted losses are added into, and why that is the point. */
export const TOTAL = {
  label: 'Total loss',
  body: 'Both networks are trained by minimising it together',
} as const;

export const TRAINING = {
  optimiser: 'AdamW',
  learningRate: 0.01,
  batch: 2048,
  schedule: 'Halved after three epochs without improvement',
  stopping: 'Held after five epochs without improvement',
  convergedAt: 56,
  maximumEpochs: 100,
  folds: 10,
} as const;

export interface Reduction {
  readonly key: string;
  readonly label: string;
  /** Prediction loss when this reduction feeds the same predictor. */
  readonly loss: number;
  readonly spread: number | null;
}

/**
 * Three ways to reach fifty dimensions, measured through the same predictor.
 *
 * The comparison is the contribution's own claim about the architecture, so it
 * is held as data and drawn from the data.
 */
export const REDUCTIONS: readonly Reduction[] = [
  { key: 'autoencoder', label: 'Autoencoder', loss: 0.002, spread: null },
  { key: 'pca', label: 'Principal component analysis', loss: 0.042, spread: 0.002 },
  {
    key: 'umap',
    label: 'Uniform manifold approximation and projection',
    loss: 0.055,
    spread: 0.002,
  },
] as const;

/**
 * The reduction comparison, in the paper's own wording.
 *
 * The ratio of the two published losses is a round twenty-one and the paper
 * states "over twenty times", so the wording is what gets printed and the
 * arithmetic is only used to check it still holds.
 */
export const REDUCTION_CLAIM = {
  label: 'Autoencoder against principal component analysis',
  value: 'Over twenty times lower loss',
} as const;

/* ---- What it achieves, and where it stops -------------------------------- */

export const SPLIT = {
  sourced: 8224,
  synthetic: 456,
  total: 8680,
  train: 6944,
  test: 1736,
} as const;

export interface Metric {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly train: number;
  readonly test: number;
  readonly overall: number;
  readonly decimals: number;
}

/** Table 1's error budget, held per split so the generalisation gap is visible. */
export const METRICS: readonly Metric[] = [
  { key: 'me', label: 'Mean error', unit: '%', train: 0.01, test: 0.01, overall: 0.01, decimals: 2 },
  {
    key: 'mae',
    label: 'Mean absolute error',
    unit: '%',
    train: 3.2,
    test: 3.9,
    overall: 3.3,
    decimals: 1,
  },
  {
    key: 'rmse',
    label: 'Root mean squared error',
    unit: '%',
    train: 6.0,
    test: 7.3,
    overall: 6.2,
    decimals: 1,
  },
  {
    key: 'r2',
    label: 'Coefficient of determination',
    unit: '',
    train: 0.83,
    test: 0.77,
    overall: 0.82,
    decimals: 2,
  },
] as const;

/** Ten independent stratified splits, reported as mean and standard deviation. */
export const CROSS_VALIDATION = [
  { key: 'prediction', label: 'Test prediction loss', mean: 0.0032, deviation: 0.0002 },
  { key: 'reconstruction', label: 'Test reconstruction loss', mean: 0.0021, deviation: 0.0001 },
] as const;

export interface Recall {
  readonly key: string;
  readonly label: string;
  /**
   * Share of products whose most probable pathway the model identifies. Null
   * where the paper reports the category as unresolved and publishes no figure;
   * a number invented to fill the gap would be a claim nobody made.
   */
  readonly share: number | null;
}

/** The confusion matrix, read as one row per pathway. */
export const RECALL: readonly Recall[] = [
  { key: 'recycling', label: 'Recycling', share: 0.9 },
  { key: 'landfill', label: 'Inert landfilling', share: 0.9 },
  { key: 'hazardous', label: 'Hazardous waste', share: 0.75 },
  { key: 'incineration', label: 'Incineration', share: 0.6 },
  { key: 'reuse', label: 'Reuse', share: null },
  { key: 'reconditioning', label: 'Reconditioning', share: null },
  { key: 'valorisation', label: 'Valorisation', share: null },
  { key: 'composting', label: 'Composting', share: null },
] as const;

/**
 * Why four of the eight stay unresolved.
 *
 * Reuse, reconditioning, valorisation and composting are reported
 * inconsistently, so two labels in the training data often describe the same
 * declared text. The measurement that shows it is reuse, which the model reads
 * as recycling in most of the test cases where reuse was the declared outcome.
 * Their individual results are therefore not conclusive, and the declarations
 * support reading them together with recycling as one recovery class.
 */
export const FLOOR = {
  label: 'Reuse, reconditioning, valorisation and composting are reported inconsistently',
  share: 0.625,
  measure: 'Reuse read as recycling',
  body: 'Their individual results are not conclusive, and the declarations support reading them together with recycling as one recovery class.',
} as const;

/* ---- What the embedding generalises over ---------------------------------- */

export interface Transfer {
  readonly key: string;
  /** What the model is handed, and why it has no exact match for it. */
  readonly declared: string;
  readonly note: string;
  /** The material terms it comes out beside, as far as the paper names them. */
  readonly neighbours: readonly string[];
  readonly pathway: string;
  readonly tone: 'energy' | 'recovery';
}

/**
 * What semantic similarity is for.
 *
 * A declaration names a material in whatever words its author chose, and new
 * materials keep arriving. The embedding places a term by meaning, so an input
 * the model has no exact match for still comes out beside terms it does know,
 * and the outcome predicted for those terms is the outcome it gets.
 *
 * Both rows are Section 4.1: an unfamiliar wood resolves beside wood, pine and
 * birch and is predicted to energy recovery through incineration, and the
 * concrete composition resolves onto ready-mix concrete, whose aggregates carry
 * a high recycling rate.
 *
 * Fig. 3 reports five nearest neighbours for each probe and the text names only
 * some of them, so every row draws a trailing mark saying the list continues.
 * Filling the rest in would be inventing distances the paper does not publish.
 */
export const TRANSFERS: readonly Transfer[] = [
  {
    key: 'unseen',
    declared: 'oak',
    note: 'A wood the model was never trained on',
    neighbours: ['wood', 'pine', 'birch'],
    pathway: 'Incineration with energy recovery',
    tone: 'energy',
  },
  {
    key: 'unnamed',
    declared: '20% cement, 60% aggregates, 20% water',
    note: 'A composition that never names its product',
    neighbours: ['ready-mix concrete'],
    pathway: 'Recycling',
    tone: 'recovery',
  },
] as const;

/** The three columns the transfers are read across. */
export const TRANSFER_STEPS = [
  'What is declared',
  'What it resolves to',
  'What is predicted',
] as const;

/** Why the property matters at all, stated once above the table. */
export const TRANSFER_CLAIM = {
  label: 'A material the model has never seen is predicted like the materials it resembles.',
  body: 'Declarations name materials in whatever words their author chose, and new products keep arriving.',
} as const;

/* ---- What the contribution settles ---------------------------------------- */

export interface Settlement {
  readonly key: string;
  /** Which mark is drawn beside the claim. */
  readonly glyph: 'ring' | 'funnel';
  readonly claim: string;
  /** A published figure, where one anchors the claim. */
  readonly figure: string | null;
}

export interface Attribute {
  readonly key: string;
  readonly label: string;
  /** Whether this contribution is the one that measured it. */
  readonly measured: boolean;
}

/**
 * The takeaways, with the reason the contribution exists first.
 *
 * The headline is the thesis claim: the recommendation is produced either way,
 * and what inference protects is the evidence behind it. The reach comes second
 * and is drawn rather than written, because a mechanism that works on one
 * attribute and a mechanism that works on any attribute correlated with
 * composition are two different contributions, and this one is the second.
 */
export const SETTLES = {
  headline: 'The recommendation keeps its quality when the evidence on a product is incomplete.',
  body: 'Construction products reach a decision with partial information, and inference completes the picture that decision is made on.',
  reach: {
    label: 'One operation, any attribute that correlates with composition',
    source: 'Material composition',
    attributes: [
      { key: 'circularity', label: 'End-of-life circularity', measured: true },
      { key: 'gwp', label: 'Global warming potential', measured: false },
      { key: 'others', label: 'and others', measured: false },
    ] as readonly Attribute[],
  },
  points: [
    {
      key: 'ground',
      glyph: 'ring',
      claim: 'Material composition is declared for every product, and it predicts what is missing',
      figure: 'R² 0.82',
    },
    {
      key: 'architecture',
      glyph: 'funnel',
      claim: 'The autoencoder is trained with the predictor, so the compression keeps what the prediction needs',
      figure: 'Over twenty times lower loss than PCA',
    },
  ] as readonly Settlement[],
} as const;

/* ---- Assertions ------------------------------------------------------------ */

function assertPublished(): void {
  if (SPLIT.sourced + SPLIT.synthetic !== SPLIT.total) {
    throw new Error(
      `C4: ${SPLIT.sourced} sourced and ${SPLIT.synthetic} synthetic products make ` +
        `${SPLIT.sourced + SPLIT.synthetic}, and the dataset is published as ${SPLIT.total}.`,
    );
  }

  if (SPLIT.train + SPLIT.test !== SPLIT.total) {
    throw new Error(
      `C4: the split holds ${SPLIT.train + SPLIT.test} products and the dataset holds ` +
        `${SPLIT.total}.`,
    );
  }

  const trainShare = SPLIT.train / SPLIT.total;
  if (Math.abs(trainShare - 0.8) > 0.001) {
    throw new Error(`C4: the training split is ${(trainShare * 100).toFixed(1)}% and 80% is published.`);
  }

  const latent = ENCODER[ENCODER.length - 1];
  const decoderIn = DECODER[0];
  if (!latent || !decoderIn || latent.units !== decoderIn.units) {
    throw new Error('C4: the decoder does not start where the encoder ends.');
  }

  const input = ENCODER[0];
  const reconstruction = DECODER[DECODER.length - 1];
  if (!input || !reconstruction || input.units !== reconstruction.units) {
    throw new Error('C4: the reconstruction is not the width of the input it is compared against.');
  }

  const head = PREDICTOR[0];
  const expected = latent.units + SCALARS.length;
  if (!head || head.units !== expected) {
    throw new Error(
      `C4: the predictor reads ${head?.units ?? 0} inputs and the latent space plus scalars ` +
        `supplies ${expected}.`,
    );
  }

  const outputs = PREDICTOR[PREDICTOR.length - 1];
  if (!outputs || outputs.units !== PATHWAY_SET.length) {
    throw new Error(
      `C4: the output layer holds ${outputs?.units ?? 0} units and ${PATHWAY_SET.length} ` +
        `pathways are named.`,
    );
  }

  if (RECALL.length !== PATHWAY_SET.length) {
    throw new Error(
      `C4: the confusion matrix reports ${RECALL.length} pathways and the model predicts ` +
        `${PATHWAY_SET.length}.`,
    );
  }

  const learned = REDUCTIONS.find((entry) => entry.key === 'autoencoder');
  const linear = REDUCTIONS.find((entry) => entry.key === 'pca');
  if (!learned || !linear) throw new Error('C4: the reduction comparison is incomplete.');
  if (linear.loss / learned.loss < 20) {
    throw new Error(
      `C4: the published losses give ${(linear.loss / learned.loss).toFixed(1)}x and ` +
        `"${REDUCTION_CLAIM.value}" is printed.`,
    );
  }
}

assertPublished();
