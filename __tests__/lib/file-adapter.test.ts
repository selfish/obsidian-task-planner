import { App, TFile } from 'obsidian';

import { ObsidianFile } from '../../src/lib/file-adapter';

describe('ObsidianFile', () => {
  it('reads fresh content instead of the display cache', async () => {
    const app = new App();
    const file = new TFile('tasks.md');
    app.vault.read = jest.fn().mockResolvedValue('fresh');

    await expect(new ObsidianFile(app, file).getContent()).resolves.toBe('fresh');
    expect(app.vault.cachedRead).not.toHaveBeenCalled();
  });

  it('uses Vault.process when available', async () => {
    const app = new App();
    const file = new TFile('tasks.md');
    const process = jest.fn(async (_file: TFile, update: (content: string) => string) => update('latest'));
    Object.assign(app.vault, { process });

    await new ObsidianFile(app, file).processContent((content) => `${content} updated`);

    expect(process).toHaveBeenCalledWith(file, expect.any(Function));
    expect(await process.mock.results[0].value).toBe('latest updated');
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  it('keeps fallback writes serialized while a file is renamed', async () => {
    const app = new App();
    const tfile = new TFile('tasks.md');
    const file = new ObsidianFile(app, tfile);
    let content = '';
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    (app.vault.read as jest.Mock).mockImplementation(async () => content);
    (app.vault.modify as jest.Mock)
      .mockImplementationOnce(async (_file: TFile, next: string) => {
        tfile.path = 'renamed.md';
        firstStarted();
        await firstPending;
        content = next;
      })
      .mockImplementation(async (_file: TFile, next: string) => {
        content = next;
      });

    const first = file.processContent((current) => current + 'A');
    await firstStartedPromise;
    const second = file.processContent((current) => current + 'B');
    await Promise.resolve();

    expect(app.vault.modify).toHaveBeenCalledTimes(1);
    releaseFirst();
    await Promise.all([first, second]);
    expect(content).toBe('AB');
  });

  it('keeps fallback read failures classified as read errors', async () => {
    const app = new App();
    const file = new ObsidianFile(app, new TFile('tasks.md'));
    (app.vault.read as jest.Mock).mockRejectedValue(new Error('read failed'));

    await expect(file.processContent((content) => content)).rejects.toMatchObject({ operation: 'read' });
  });

  it('serializes the Obsidian 1.0 read-modify-write fallback', async () => {
    const app = new App();
    const file = new TFile('tasks.md');
    let content = 'task';
    app.vault.read = jest.fn(async () => content);
    app.vault.modify = jest.fn(async (_file: TFile, updated: string) => {
      content = updated;
    });
    const adapter = new ObsidianFile(app, file);

    await Promise.all([adapter.processContent((current) => `${current} A`), adapter.processContent((current) => `${current} B`)]);

    expect(content).toBe('task A B');
  });

  it('fails closed when fallback content changes before writing', async () => {
    const app = new App();
    const file = new ObsidianFile(app, new TFile('tasks.md'));
    (app.vault.read as jest.Mock).mockResolvedValueOnce('task').mockResolvedValueOnce('external edit');

    await expect(file.processContent((content) => `${content} updated`)).rejects.toThrow(/changed during update/i);
    expect(app.vault.modify).not.toHaveBeenCalled();
  });
});
