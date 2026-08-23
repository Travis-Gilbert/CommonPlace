#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct CellAddress {
    pub row: usize,
    pub column: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FocusState {
    None,
    Soft(CellAddress),
    Hard { cell: CellAddress, draft: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KeyIntent {
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Enter,
    Type(String),
    Escape,
    Tab { backwards: bool },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FocusEffect {
    None,
    MountEditor(CellAddress),
    Commit {
        cell: CellAddress,
        advance_to: CellAddress,
    },
    CancelEdit(CellAddress),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FocusTransition {
    pub state: FocusState,
    pub effect: FocusEffect,
}

impl FocusState {
    #[must_use]
    pub fn reduce(self, intent: KeyIntent, rows: usize, columns: usize) -> FocusTransition {
        if rows == 0 || columns == 0 {
            return FocusTransition {
                state: FocusState::None,
                effect: FocusEffect::None,
            };
        }
        match (self, intent) {
            (Self::None, KeyIntent::Escape) => transition(Self::None),
            (Self::None, _) => transition(Self::Soft(CellAddress { row: 0, column: 0 })),
            (Self::Soft(_), KeyIntent::Escape) => transition(Self::None),
            (Self::Soft(cell), KeyIntent::Enter) => FocusTransition {
                state: Self::Hard {
                    cell,
                    draft: String::new(),
                },
                effect: FocusEffect::MountEditor(cell),
            },
            (Self::Soft(cell), KeyIntent::Type(text)) => FocusTransition {
                state: Self::Hard { cell, draft: text },
                effect: FocusEffect::MountEditor(cell),
            },
            (Self::Soft(cell), direction) => {
                transition(Self::Soft(moved(cell, direction, rows, columns)))
            }
            (Self::Hard { cell, .. }, KeyIntent::Escape) => FocusTransition {
                state: Self::Soft(cell),
                effect: FocusEffect::CancelEdit(cell),
            },
            (Self::Hard { cell, .. }, KeyIntent::Tab { backwards }) => {
                let advance_to = tabbed(cell, backwards, rows, columns);
                FocusTransition {
                    state: Self::Soft(advance_to),
                    effect: FocusEffect::Commit { cell, advance_to },
                }
            }
            (state @ Self::Hard { .. }, _) => transition(state),
        }
    }
}

fn transition(state: FocusState) -> FocusTransition {
    FocusTransition {
        state,
        effect: FocusEffect::None,
    }
}

fn moved(cell: CellAddress, intent: KeyIntent, rows: usize, columns: usize) -> CellAddress {
    match intent {
        KeyIntent::ArrowUp => CellAddress {
            row: cell.row.saturating_sub(1),
            ..cell
        },
        KeyIntent::ArrowDown => CellAddress {
            row: (cell.row + 1).min(rows - 1),
            ..cell
        },
        KeyIntent::ArrowLeft => CellAddress {
            column: cell.column.saturating_sub(1),
            ..cell
        },
        KeyIntent::ArrowRight => CellAddress {
            column: (cell.column + 1).min(columns - 1),
            ..cell
        },
        KeyIntent::Tab { backwards } => tabbed(cell, backwards, rows, columns),
        _ => cell,
    }
}

fn tabbed(cell: CellAddress, backwards: bool, rows: usize, columns: usize) -> CellAddress {
    let linear = cell.row.saturating_mul(columns).saturating_add(cell.column);
    let max = rows.saturating_mul(columns).saturating_sub(1);
    let next = if backwards {
        linear.saturating_sub(1)
    } else {
        (linear + 1).min(max)
    };
    CellAddress {
        row: next / columns,
        column: next % columns,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arrows_enter_escape_and_tab_follow_soft_hard_model() {
        let soft = FocusState::Soft(CellAddress { row: 1, column: 1 });
        let moved = soft.clone().reduce(KeyIntent::ArrowRight, 3, 3);
        assert_eq!(
            moved.state,
            FocusState::Soft(CellAddress { row: 1, column: 2 })
        );
        let hard = soft.reduce(KeyIntent::Type("A".into()), 3, 3);
        assert_eq!(
            hard.state,
            FocusState::Hard {
                cell: CellAddress { row: 1, column: 1 },
                draft: "A".into()
            }
        );
        let tab = hard.state.reduce(KeyIntent::Tab { backwards: false }, 3, 3);
        assert_eq!(
            tab.effect,
            FocusEffect::Commit {
                cell: CellAddress { row: 1, column: 1 },
                advance_to: CellAddress { row: 1, column: 2 }
            }
        );
        assert!(matches!(
            FocusState::Hard {
                cell: CellAddress { row: 0, column: 0 },
                draft: String::new()
            }
            .reduce(KeyIntent::Escape, 1, 1)
            .effect,
            FocusEffect::CancelEdit(_)
        ));
    }
}
