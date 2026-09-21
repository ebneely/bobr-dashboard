import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ImageField } from '@/components/ImageField';
import { ApiError } from '@/lib/api/client';
import {
  checkImageFile,
  cropOutputType,
  cropToBlob,
  IMAGE_FIELD_MAX_BYTES,
  naturalCropRect,
} from '@/lib/image-crop';
import pl from '@/messages/pl.json';

/**
 * next-intl ships ESM only, which this Jest setup does not transform, so
 * useTranslations(namespace) is stood in for by a lookup into the real Polish
 * messages — a missing key fails the test instead of rendering a key path.
 */
jest.mock('next-intl', () => {
  const messages = jest.requireActual('../messages/pl.json');
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  return {
    useTranslations: (namespace: string) => {
      const full = (key: string) => `${namespace}.${key}`;
      return Object.assign(
        (key: string) => {
          const value = lookup(full(key));
          if (typeof value !== 'string') throw new Error(`missing message ${full(key)}`);
          return value;
        },
        { has: (key: string) => typeof lookup(full(key)) === 'string' },
      );
    },
  };
});

// jsdom has no canvas encoder; the pixel maths is tested on its own below.
jest.mock('@/lib/image-crop', () => ({
  ...jest.requireActual('@/lib/image-crop'),
  cropToBlob: jest.fn(async () => new Blob(['cropped'], { type: 'image/jpeg' })),
}));

const t = pl.imageField;

function jpeg(name = 'meal.jpg', size = 1024) {
  const file = new File(['x'], name, { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function drop(file: File) {
  fireEvent.drop(screen.getByTestId('image-field-dropzone'), {
    dataTransfer: { files: [file] },
  });
}

/** Stands in for the browser laying the picture out, which fires onLoad. */
function loadCropImage() {
  const img = screen.getByAltText(t.crop.alt) as HTMLImageElement;
  Object.defineProperty(img, 'width', { value: 800, configurable: true });
  Object.defineProperty(img, 'height', { value: 600, configurable: true });
  fireEvent.load(img);
}

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => 'blob:local/1');
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => jest.mocked(cropToBlob).mockClear());

describe('ImageField', () => {
  it('drop → crop dialog → confirm hands onUpload the cropped Blob', async () => {
    const onUpload = jest.fn(async (_file: Blob) => {});
    render(<ImageField label="Zdjęcie" aspect={4 / 3} onUpload={onUpload} />);

    expect(screen.getByText(t.dropHint)).toBeInTheDocument();
    drop(jpeg());

    expect(await screen.findByText(t.crop.title)).toBeInTheDocument();
    expect(screen.getByText(t.crop.descriptionFixed)).toBeInTheDocument();
    loadCropImage();
    fireEvent.click(screen.getByTestId('image-field-crop-confirm'));

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    const sent = onUpload.mock.calls[0][0];
    expect(sent).toBeInstanceOf(Blob);
    expect(sent.type).toBe('image/jpeg');
    // The crop step got the aspect, so the output is snapped to it.
    expect(jest.mocked(cropToBlob).mock.calls[0][3]).toBeCloseTo(4 / 3);
    await waitFor(() => expect(screen.queryByText(t.crop.title)).not.toBeInTheDocument());
  });

  it('click-to-choose goes through the same crop step', async () => {
    const onUpload = jest.fn(async (_file: Blob) => {});
    render(<ImageField label="Zdjęcie" onUpload={onUpload} />);
    fireEvent.change(screen.getByTestId('image-field-input'), {
      target: { files: [jpeg()] },
    });
    expect(await screen.findByText(t.crop.descriptionFree)).toBeInTheDocument();
  });

  it('cancelling the crop uploads nothing', async () => {
    const onUpload = jest.fn(async (_file: Blob) => {});
    render(<ImageField label="Zdjęcie" aspect={4 / 3} onUpload={onUpload} />);
    drop(jpeg());
    fireEvent.click(await screen.findByText(t.crop.cancel));
    await waitFor(() => expect(screen.queryByText(t.crop.title)).not.toBeInTheDocument());
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('refuses a file over 15 MB with a translated message, before any crop', () => {
    render(<ImageField label="Zdjęcie" onUpload={jest.fn()} />);
    drop(jpeg('big.jpg', IMAGE_FIELD_MAX_BYTES + 1));
    expect(screen.getByTestId('image-field-error')).toHaveTextContent(t.errors.tooLarge);
    expect(screen.queryByText(t.crop.title)).not.toBeInTheDocument();
  });

  it('refuses anything but JPEG, PNG and WebP', () => {
    render(<ImageField label="Zdjęcie" onUpload={jest.fn()} />);
    drop(new File(['x'], 'clip.mp4', { type: 'video/mp4' }));
    expect(screen.getByTestId('image-field-error')).toHaveTextContent(t.errors.type);
  });

  it('words an API failure through formatApiError', async () => {
    const onUpload = jest.fn(async () => {
      throw new ApiError(422, {
        statusCode: 422,
        message: 'Unsupported image',
        error: 'Unprocessable Entity',
      });
    });
    render(<ImageField label="Zdjęcie" aspect={4 / 3} onUpload={onUpload} />);
    drop(jpeg());
    await screen.findByText(t.crop.title);
    loadCropImage();
    fireEvent.click(screen.getByTestId('image-field-crop-confirm'));
    expect(await screen.findByTestId('image-field-error')).toHaveTextContent('Unsupported image');
  });

  it('shows the current image and offers to replace it', () => {
    render(<ImageField label="Zdjęcie" value="https://cdn.example/meal.webp" onUpload={jest.fn()} />);
    expect(screen.getByTestId('image-field-preview')).toHaveAttribute(
      'src',
      'https://cdn.example/meal.webp',
    );
    expect(screen.getByTestId('image-field-choose')).toHaveTextContent(t.replace);
  });
});

describe('image-crop helpers', () => {
  it('snaps a 4:3 crop to exact pixels', () => {
    const rect = naturalCropRect(
      { unit: '%', x: 5, y: 5, width: 90, height: 90.13 },
      4000,
      3000,
      4 / 3,
    );
    expect(rect.width / rect.height).toBe(4 / 3);
    expect(rect).toEqual({ x: 200, y: 150, width: 3600, height: 2700 });
  });

  it('never runs a snapped crop off the bottom of the image', () => {
    const rect = naturalCropRect({ unit: '%', x: 0, y: 50, width: 100, height: 50 }, 1000, 1000, 4 / 3);
    expect(rect.y + rect.height).toBeLessThanOrEqual(1000);
    expect(Math.abs(rect.width / rect.height - 4 / 3)).toBeLessThan(0.01);
  });

  it('accepts only jpeg/png/webp up to 15 MB', () => {
    expect(checkImageFile(jpeg())).toBeNull();
    expect(checkImageFile(new File(['x'], 'a.heic', { type: 'image/heic' }))).toBe('type');
    expect(checkImageFile(jpeg('b.jpg', IMAGE_FIELD_MAX_BYTES + 1))).toBe('tooLarge');
  });

  it('keeps transparency by encoding PNG/WebP sources as WebP', () => {
    expect(cropOutputType('image/png')).toBe('image/webp');
    expect(cropOutputType('image/webp')).toBe('image/webp');
    expect(cropOutputType('image/jpeg')).toBe('image/jpeg');
  });
});
