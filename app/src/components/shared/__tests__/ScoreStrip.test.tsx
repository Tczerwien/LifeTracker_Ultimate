import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreStrip, { ScoreStripSkeleton } from '../ScoreStrip';

const defaultProps = {
  finalScore: 0.84,
  baseScore: 0.8,
  streak: 12,
  positiveScore: 0.88,
  vicePenalty: 0.05,
};

describe('ScoreStrip', () => {
  it('renders all 5 KPI labels', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText('Final Score')).toBeInTheDocument();
    expect(screen.getByText('Base Score')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByText('Positive %')).toBeInTheDocument();
    expect(screen.getByText('Vice %')).toBeInTheDocument();
  });

  it('formats final score as fixed decimal', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText('0.84')).toBeInTheDocument();
  });

  it('formats base score as fixed decimal', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText('0.80')).toBeInTheDocument();
  });

  it('displays streak with flame emoji and day count', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText(/🔥 12 days/)).toBeInTheDocument();
  });

  it('uses gold color for streak >= 7', () => {
    render(<ScoreStrip {...defaultProps} streak={7} />);
    const streakEl = screen.getByText(/🔥 7 days/);
    expect(streakEl.style.color).toBe('rgb(255, 215, 0)'); // #FFD700
  });

  it('does not use gold color for streak < 7', () => {
    render(<ScoreStrip {...defaultProps} streak={3} />);
    const streakEl = screen.getByText(/🔥 3 days/);
    expect(streakEl.style.color).not.toBe('rgb(255, 215, 0)');
  });

  it('displays positive percentage', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('displays vice percentage', () => {
    render(<ScoreStrip {...defaultProps} />);
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders zero values correctly', () => {
    render(
      <ScoreStrip
        finalScore={0}
        baseScore={0}
        streak={0}
        positiveScore={0}
        vicePenalty={0}
      />,
    );
    // Both finalScore and baseScore render as '0.00'
    expect(screen.getAllByText('0.00')).toHaveLength(2);
    expect(screen.getByText(/🔥 0 days/)).toBeInTheDocument();
    // Both positive% and vice% render as '0%'
    expect(screen.getAllByText('0%')).toHaveLength(2);
  });
});

describe('ScoreStripSkeleton', () => {
  it('renders 5 skeleton cells', () => {
    const { container } = render(<ScoreStripSkeleton />);
    const cells = container.querySelectorAll('.text-center');
    expect(cells).toHaveLength(5);
  });
});
