(() => {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const state = {
    freecells: Array.from({ length: 4 }, () => null),
    foundations: Array.from({ length: 4 }, () => []),
    tableau: Array.from({ length: 8 }, () => []),
    selection: null,
  };

  const board = {
    freecells: document.getElementById("freecells"),
    foundations: document.getElementById("foundations"),
    tableau: document.getElementById("tableau"),
    newGame: document.getElementById("new-game"),
  };

  const isRed = (card) => card.suit === "♥" || card.suit === "♦";

  function shuffledDeck() {
    const deck = [];
    for (const suit of suits) {
      for (let value = 1; value <= 13; value += 1) {
        deck.push({ suit, value, id: `${suit}${value}` });
      }
    }
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function newGame() {
    state.freecells = Array.from({ length: 4 }, () => null);
    state.foundations = Array.from({ length: 4 }, () => []);
    state.tableau = Array.from({ length: 8 }, () => []);
    state.selection = null;

    const deck = shuffledDeck();
    for (let i = 0; i < deck.length; i += 1) {
      state.tableau[i % 8].push(deck[i]);
    }
    render();
    autoMoveObvious();
  }

  function getFoundationIndex(card) {
    return suits.indexOf(card.suit);
  }

  function canMoveToFoundation(card) {
    const foundation = state.foundations[getFoundationIndex(card)];
    return foundation.length + 1 === card.value;
  }

  function isObviousFoundationMove(card) {
    if (!canMoveToFoundation(card)) return false;
    if (card.value <= 2) return true;
    const blackMin = Math.min(
      state.foundations[getFoundationIndex({ suit: "♠" })].length,
      state.foundations[getFoundationIndex({ suit: "♣" })].length,
    );
    const redMin = Math.min(
      state.foundations[getFoundationIndex({ suit: "♥" })].length,
      state.foundations[getFoundationIndex({ suit: "♦" })].length,
    );
    if (isRed(card)) return blackMin >= card.value - 2;
    return redMin >= card.value - 2;
  }

  function canStackOn(sourceCard, targetCard) {
    return sourceCard.value + 1 === targetCard.value && isRed(sourceCard) !== isRed(targetCard);
  }

  function validTableauStack(column, start) {
    for (let i = start; i < column.length - 1; i += 1) {
      if (!canStackOn(column[i + 1], column[i])) return false;
    }
    return true;
  }

  function moveCapacity(emptyColumns, emptyFreecells) {
    return (emptyFreecells + 1) * (2 ** emptyColumns);
  }

  function currentMoveCapacity(destinationColumnIndex) {
    const emptyFreecells = state.freecells.filter((cell) => !cell).length;
    let emptyColumns = 0;
    for (let i = 0; i < state.tableau.length; i += 1) {
      if (state.tableau[i].length === 0 && i !== destinationColumnIndex) emptyColumns += 1;
    }
    return moveCapacity(emptyColumns, emptyFreecells);
  }

  function trySelectFromTableau(columnIndex, cardIndex) {
    const column = state.tableau[columnIndex];
    if (!column[cardIndex]) return;
    if (!validTableauStack(column, cardIndex)) return;
    state.selection = { type: "tableau", columnIndex, cardIndex };
    render();
  }

  function selectedCards() {
    if (!state.selection) return [];
    if (state.selection.type === "freecell") {
      const card = state.freecells[state.selection.index];
      return card ? [card] : [];
    }
    if (state.selection.type === "tableau") {
      return state.tableau[state.selection.columnIndex].slice(state.selection.cardIndex);
    }
    return [];
  }

  function clearSelection() {
    state.selection = null;
  }

  function tryMoveToFreecell(index) {
    if (!state.selection || state.freecells[index]) return false;
    const cards = selectedCards();
    if (cards.length !== 1) return false;
    const card = cards[0];

    if (state.selection.type === "tableau") {
      state.tableau[state.selection.columnIndex].pop();
    } else {
      state.freecells[state.selection.index] = null;
    }
    state.freecells[index] = card;
    return true;
  }

  function tryMoveToFoundation(index) {
    if (!state.selection) return false;
    const cards = selectedCards();
    if (cards.length !== 1) return false;
    const card = cards[0];
    if (getFoundationIndex(card) !== index || !canMoveToFoundation(card)) return false;

    if (state.selection.type === "tableau") {
      state.tableau[state.selection.columnIndex].pop();
    } else {
      state.freecells[state.selection.index] = null;
    }
    state.foundations[index].push(card);
    return true;
  }

  function tryMoveToTableau(columnIndex) {
    if (!state.selection) return false;
    const cards = selectedCards();
    if (cards.length === 0) return false;

    if (state.selection.type === "tableau" && state.selection.columnIndex === columnIndex) return false;

    const dest = state.tableau[columnIndex];
    const first = cards[0];
    const target = dest[dest.length - 1];
    if (target && !canStackOn(first, target)) return false;

    if (state.selection.type === "tableau") {
      const moveCount = cards.length;
      if (moveCount > currentMoveCapacity(columnIndex)) return false;
      const source = state.tableau[state.selection.columnIndex];
      source.splice(state.selection.cardIndex, moveCount);
      dest.push(...cards);
    } else {
      state.freecells[state.selection.index] = null;
      dest.push(first);
    }
    return true;
  }

  function firstEmptyFreecellIndex() {
    return state.freecells.findIndex((cell) => !cell);
  }

  function findAutoTableauDestination(card, sourceColumnIndex = -1) {
    for (let i = 0; i < state.tableau.length; i += 1) {
      if (i === sourceColumnIndex) continue;
      const target = state.tableau[i][state.tableau[i].length - 1];
      if (target && canStackOn(card, target)) return i;
    }
    return -1;
  }

  function tryAutoTapMoveFromTableau(columnIndex, cardIndex) {
    const column = state.tableau[columnIndex];
    if (cardIndex !== column.length - 1) return false;
    const card = column[cardIndex];
    if (!card) return false;

    const destination = findAutoTableauDestination(card, columnIndex);
    if (destination >= 0) {
      column.pop();
      state.tableau[destination].push(card);
      return true;
    }

    const freecellIndex = firstEmptyFreecellIndex();
    if (freecellIndex >= 0) {
      column.pop();
      state.freecells[freecellIndex] = card;
      return true;
    }

    return false;
  }

  function tryAutoTapMoveFromFreecell(index) {
    const card = state.freecells[index];
    if (!card) return false;
    const destination = findAutoTableauDestination(card);
    if (destination < 0) return false;
    state.freecells[index] = null;
    state.tableau[destination].push(card);
    return true;
  }

  function finalizeMovedCard() {
    clearSelection();
    render();
    autoMoveObvious();
    autoFinishIfReady();
    render();
  }

  function onSlotTap(type, index, maybeCardIndex) {
    if (!state.selection) {
      if (type === "freecell" && state.freecells[index]) {
        if (tryAutoTapMoveFromFreecell(index)) {
          finalizeMovedCard();
          return;
        }
        state.selection = { type: "freecell", index };
        render();
      } else if (type === "tableau") {
        const cardIndex = maybeCardIndex ?? state.tableau[index].length - 1;
        if (tryAutoTapMoveFromTableau(index, cardIndex)) {
          finalizeMovedCard();
          return;
        }
        trySelectFromTableau(index, cardIndex);
      }
      return;
    }

    let moved = false;
    if (type === "freecell") moved = tryMoveToFreecell(index);
    if (type === "foundation") moved = tryMoveToFoundation(index);
    if (type === "tableau") moved = tryMoveToTableau(index);

    if (!moved && type === "tableau") {
      trySelectFromTableau(index, maybeCardIndex ?? state.tableau[index].length - 1);
      return;
    }

    if (moved) finalizeMovedCard();
    else {
      clearSelection();
      render();
    }
  }

  function moveTopCardToFoundationFromTableau(columnIndex) {
    const column = state.tableau[columnIndex];
    const card = column[column.length - 1];
    if (!card || !isObviousFoundationMove(card)) return false;
    column.pop();
    state.foundations[getFoundationIndex(card)].push(card);
    return true;
  }

  function moveCardToFoundationFromFreecell(index) {
    const card = state.freecells[index];
    if (!card || !isObviousFoundationMove(card)) return false;
    state.freecells[index] = null;
    state.foundations[getFoundationIndex(card)].push(card);
    return true;
  }

  function autoMoveObvious() {
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < state.freecells.length; i += 1) {
        moved = moveCardToFoundationFromFreecell(i) || moved;
      }
      for (let i = 0; i < state.tableau.length; i += 1) {
        moved = moveTopCardToFoundationFromTableau(i) || moved;
      }
    }
  }

  function canAutoFinish() {
    return state.tableau.every((column) => {
      for (let i = 0; i < column.length - 1; i += 1) {
        if (!canStackOn(column[i + 1], column[i])) return false;
      }
      return true;
    });
  }

  function autoFinishIfReady() {
    if (!canAutoFinish()) return;
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < state.freecells.length; i += 1) {
        const card = state.freecells[i];
        if (card && canMoveToFoundation(card)) {
          state.freecells[i] = null;
          state.foundations[getFoundationIndex(card)].push(card);
          moved = true;
        }
      }
      for (let i = 0; i < state.tableau.length; i += 1) {
        const column = state.tableau[i];
        const card = column[column.length - 1];
        if (card && canMoveToFoundation(card)) {
          column.pop();
          state.foundations[getFoundationIndex(card)].push(card);
          moved = true;
        }
      }
    }
  }

  function renderCard(card, selected) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `card ${isRed(card) ? "red" : ""}${selected ? " selected" : ""}`;
    el.dataset.cardId = card.id;
    const rank = ranks[card.value - 1];
    el.innerHTML = `
      <span class="card-corner">
        <span class="card-rank">${rank}</span>
        <span class="card-suit">${card.suit}</span>
      </span>
      <span class="card-center-suit">${card.suit}</span>
    `;
    return el;
  }

  function animateCardMoves(previousRects) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".card[data-card-id]").forEach((cardEl) => {
      const previousRect = previousRects.get(cardEl.dataset.cardId);
      if (!previousRect) return;
      const nextRect = cardEl.getBoundingClientRect();
      const dx = previousRect.left - nextRect.left;
      const dy = previousRect.top - nextRect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      cardEl.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "" },
        ],
        { duration: 220, easing: "ease-out" },
      );
    });
  }

  function render() {
    const previousRects = new Map();
    document.querySelectorAll(".card[data-card-id]").forEach((cardEl) => {
      previousRects.set(cardEl.dataset.cardId, cardEl.getBoundingClientRect());
    });

    board.freecells.innerHTML = "";
    board.foundations.innerHTML = "";
    board.tableau.innerHTML = "";

    for (let i = 0; i < 4; i += 1) {
      const cell = document.createElement("div");
      cell.className = "slot";
      cell.addEventListener("click", () => onSlotTap("freecell", i));
      const card = state.freecells[i];
      if (card) {
        const selected = state.selection?.type === "freecell" && state.selection.index === i;
        cell.appendChild(renderCard(card, selected));
      }
      board.freecells.appendChild(cell);
    }

    for (let i = 0; i < 4; i += 1) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.addEventListener("click", () => onSlotTap("foundation", i));
      const foundation = state.foundations[i];
      if (foundation.length) {
        slot.appendChild(renderCard(foundation[foundation.length - 1], false));
      }
      board.foundations.appendChild(slot);
    }

    for (let c = 0; c < 8; c += 1) {
      const columnEl = document.createElement("div");
      columnEl.className = "column";
      columnEl.addEventListener("click", () => onSlotTap("tableau", c));
      const column = state.tableau[c];
      for (let i = 0; i < column.length; i += 1) {
        const selected = state.selection?.type === "tableau"
          && state.selection.columnIndex === c
          && i >= state.selection.cardIndex;
        const cardEl = renderCard(column[i], selected);
        cardEl.style.top = `${i * 1.35}rem`;
        cardEl.addEventListener("click", (event) => {
          event.stopPropagation();
          onSlotTap("tableau", c, i);
        });
        columnEl.appendChild(cardEl);
      }
      board.tableau.appendChild(columnEl);
    }

    animateCardMoves(previousRects);
  }

  board.newGame.addEventListener("click", newGame);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  newGame();
})();
