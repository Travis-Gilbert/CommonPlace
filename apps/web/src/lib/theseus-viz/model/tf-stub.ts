// SOURCING: none — stub after @tensorflow/tfjs cut (HANDOFF-CANON C3)
export type TFModule = {
  ready(): Promise<void>
  tensor(values: unknown, shape?: number[]): { dispose(): void }
  tidy<T>(fn: () => T): T
  loadLayersModel(path: string): Promise<LayersModel>
}
export type LayersModel = {
  predict(input: unknown): { data(): Promise<Float32Array>; dispose(): void }
  dispose(): void
}
export type Tensor = { dispose(): void; data(): Promise<Float32Array> }
