export function inferModelCategory(modelName: string): string {
  const model = modelName.toLowerCase();

  if (model.includes('random')) {
    return 'Random baseline';
  }

  if (model.includes('clip') || model.includes('siglip')) {
    return 'Vision-language';
  }

  if (model.includes('vit') || model.includes('beit') || model.includes('dino') || model.includes('eva')) {
    return 'Transformer';
  }

  if (model.includes('taskonomy')) {
    return 'Taskonomy';
  }

  if (model.includes('robust')) {
    return 'Robust model';
  }

  if (model.includes('resnet') || model.includes('rn') || model.includes('vgg') || model.includes('densenet')) {
    return 'CNN';
  }

  return 'Model';
}
