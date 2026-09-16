// Exhaustive legal-move proof, independent of puzzle labels or engine evaluations.
// Intended only for the offline builder/tests, never imported by the app.
export function uci(move) {
  return move.from + move.to + (move.promotion ?? '');
}
export function playUci(board, move) {
  return board.move({
    from: move.slice(0, 2),
    to: move.slice(2, 4),
    promotion: move[4],
  });
}
export function matingMoves(board, movesToMate) {
  const result = [];
  for (const move of board.moves({ verbose: true })) {
    board.move(move);
    let wins = board.isCheckmate();
    if (!wins && movesToMate > 1 && !board.isStalemate()) {
      const replies = board.moves({ verbose: true });
      wins =
        replies.length > 0 &&
        replies.every((reply) => {
          board.move(reply);
          // If the attacker is mated or stalemated, there is no mating continuation.
          const hasMate = board.moves({ verbose: true }).some((last) => {
            board.move(last);
            const mate = board.isCheckmate();
            board.undo();
            return mate;
          });
          board.undo();
          return hasMate;
        });
    }
    board.undo();
    if (wins) result.push(uci(move));
  }
  return result;
}

