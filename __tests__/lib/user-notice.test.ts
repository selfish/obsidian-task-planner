import { Notice } from 'obsidian';
import { showErrorNotice, showSuccessNotice, showInfoNotice } from '../../src/lib/user-notice';
import { TaskPlannerError, FileOperationError, ParseError } from '../../src/lib/errors';

jest.mock('obsidian', () => ({
  Notice: jest.fn(),
}));

describe('showErrorNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with string errors', () => {
    it('should show notice with string message', () => {
      showErrorNotice('Something went wrong');

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner: Something went wrong',
        5000
      );
    });

    it('should use provided tier for duration', () => {
      showErrorNotice('Error', 'CRITICAL');

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner Error: Error',
        10000
      );
    });

    it('should use LOW tier with no prefix', () => {
      showErrorNotice('Minor issue', 'LOW');

      expect(Notice).toHaveBeenCalledWith('Minor issue', 3000);
    });

    it('should use HIGH tier duration', () => {
      showErrorNotice('Important error', 'HIGH');

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner: Important error',
        7000
      );
    });
  });

  describe('with Error objects', () => {
    it('should extract message from Error', () => {
      const error = new Error('Standard error message');

      showErrorNotice(error);

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner: Standard error message',
        5000
      );
    });

    it('should use provided tier even with Error objects', () => {
      const error = new Error('Error');

      showErrorNotice(error, 'CRITICAL');

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner Error: Error',
        10000
      );
    });
  });

  describe('with TaskPlannerError', () => {
    it('should use tier from TaskPlannerError', () => {
      const error = new TaskPlannerError('Custom error', 'CRITICAL');

      showErrorNotice(error);

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner Error: Custom error',
        10000
      );
    });

    it('should override provided tier with error tier', () => {
      const error = new TaskPlannerError('Error', 'LOW');

      // Even if we pass CRITICAL, the error's tier should be used
      showErrorNotice(error, 'CRITICAL');

      expect(Notice).toHaveBeenCalledWith('Error', 3000);
    });

    it('should work with FileOperationError', () => {
      const error = new FileOperationError(
        'Failed to read file',
        '/path/file.md',
        'read',
        'HIGH'
      );

      showErrorNotice(error);

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner: Failed to read file',
        7000
      );
    });

    it('should work with ParseError', () => {
      const error = new ParseError('Invalid syntax', '/file.md', 10, 'MEDIUM');

      showErrorNotice(error);

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner: Invalid syntax',
        5000
      );
    });
  });

  describe('tier-specific behavior', () => {
    it('should handle CRITICAL tier correctly', () => {
      showErrorNotice('Critical', 'CRITICAL');

      expect(Notice).toHaveBeenCalledWith(
        'Task Planner Error: Critical',
        10000
      );
    });

    it('should handle HIGH tier correctly', () => {
      showErrorNotice('High', 'HIGH');

      expect(Notice).toHaveBeenCalledWith('Task Planner: High', 7000);
    });

    it('should handle MEDIUM tier correctly', () => {
      showErrorNotice('Medium', 'MEDIUM');

      expect(Notice).toHaveBeenCalledWith('Task Planner: Medium', 5000);
    });

    it('should handle LOW tier correctly', () => {
      showErrorNotice('Low', 'LOW');

      expect(Notice).toHaveBeenCalledWith('Low', 3000);
    });
  });
});

describe('showSuccessNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show notice with message and default duration', () => {
    showSuccessNotice('Task completed');

    expect(Notice).toHaveBeenCalledWith('Task completed', 3000);
  });

  it('should accept custom duration', () => {
    showSuccessNotice('Saved!', 5000);

    expect(Notice).toHaveBeenCalledWith('Saved!', 5000);
  });

  it('should work with empty message', () => {
    showSuccessNotice('');

    expect(Notice).toHaveBeenCalledWith('', 3000);
  });
});

describe('showInfoNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show notice with message and default duration', () => {
    showInfoNotice('Processing...');

    expect(Notice).toHaveBeenCalledWith('Processing...', 4000);
  });

  it('should accept custom duration', () => {
    showInfoNotice('Loading', 2000);

    expect(Notice).toHaveBeenCalledWith('Loading', 2000);
  });

  it('should work with long messages', () => {
    const longMessage = 'This is a very long informational message that spans multiple lines';

    showInfoNotice(longMessage);

    expect(Notice).toHaveBeenCalledWith(longMessage, 4000);
  });
});
