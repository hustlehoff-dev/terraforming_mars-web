import {expect} from 'chai';
import {readFileSync} from 'fs';
import {boardGeometry, neighbours} from '@/client/components/board/BoardGeometry';

function lessMargins(large: boolean): Map<string, {top: number, left: number}> {
  const less = readFileSync('src/styles/board_items_positions.less', 'utf8');
  const start = less.indexOf('.board--large {');
  const section = large ? less.slice(start) : less.slice(0, start);
  const margins = new Map<string, {top: number, left: number}>();
  for (const match of section.matchAll(/\.board-space-(\d\d) \{ margin: (-?[\d.]+)px 0 0 (-?[\d.]+)px; \}/g)) {
    margins.set(match[1], {top: Number(match[2]), left: Number(match[3])});
  }
  return margins;
}

describe('BoardGeometry', () => {
  for (const large of [false, true]) {
    it(`matches the classic space positions (${large ? 'large' : 'standard'} board)`, () => {
      const geometry = boardGeometry(large);
      const margins = lessMargins(large);
      expect(geometry.cells).to.have.lengthOf(large ? 91 : 61);
      for (const cell of geometry.cells) {
        const margin = margins.get(cell.id);
        expect(margin, cell.id).not.to.be.undefined;
        expect(cell.top, cell.id).to.eq(margin!.top);
        expect(cell.left, cell.id).to.be.closeTo(margin!.left, 0.6);
      }
    });
  }

  it('finds six neighbours for an inner space and lattice columns 24.5px apart', () => {
    const geometry = boardGeometry(false);
    const centre = geometry.byId.get('33')!;
    expect(neighbours(geometry, centre)).to.have.lengthOf(6);
    for (const cell of geometry.cells) {
      expect(cell.x).to.be.closeTo(geometry.latticeX + cell.column * 24.5, 1e-9);
      expect(cell.y).to.be.closeTo(geometry.latticeY + (cell.row - geometry.middleRow) * 41, 1e-9);
    }
  });
});
