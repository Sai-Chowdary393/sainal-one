// =========================================================
// SAINAL ONE
// WORKFLOW RUNTIME - CONDITION ENGINE
// =========================================================
//
// This file evaluates workflow Condition nodes.
//
// For the first runtime version we support:
//
// equals
// not_equals
// greater_than
// greater_than_or_equal
// less_than
// less_than_or_equal
// contains
// not_contains
// is_empty
// is_not_empty
// in
// not_in
//
// AI and Formula conditions will be added later.
// =========================================================

function getNestedValue(
  source,
  path
) {
  if (
    !source ||
    !path
  ) {
    return undefined;
  }

  return String(path)
    .split(".")
    .reduce(
      (current, key) => {
        if (
          current === null ||
          current === undefined
        ) {
          return undefined;
        }

        return current[key];
      },
      source
    );
}

function isEmpty(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return true;
  }

  if (
    typeof value === "string"
  ) {
    return (
      value.trim().length === 0
    );
  }

  if (
    Array.isArray(value)
  ) {
    return value.length === 0;
  }

  return false;
}

function compareNumbers(
  left,
  right,
  operator
) {
  const leftNumber =
    Number(left);

  const rightNumber =
    Number(right);

  if (
    !Number.isFinite(
      leftNumber
    ) ||
    !Number.isFinite(
      rightNumber
    )
  ) {
    return false;
  }

  switch (operator) {
    case "greater_than":
      return (
        leftNumber >
        rightNumber
      );

    case "greater_than_or_equal":
      return (
        leftNumber >=
        rightNumber
      );

    case "less_than":
      return (
        leftNumber <
        rightNumber
      );

    case "less_than_or_equal":
      return (
        leftNumber <=
        rightNumber
      );

    default:
      return false;
  }
}

export function evaluateCondition({
  step,
  payload = {},
}) {
  if (!step) {
    throw new Error(
      "Condition step is required."
    );
  }

  const conditionType =
    step.condition_type ||
    "Field";

  /*
   * Formula and AI conditions will
   * be implemented later.
   */
  if (
    conditionType !== "Field"
  ) {
    throw new Error(
      `${conditionType} conditions are not executable yet.`
    );
  }

  const field =
    step.condition_field;

  const operator =
    step.condition_operator;

  if (!field) {
    throw new Error(
      `Condition step "${step.name}" does not define a field.`
    );
  }

  if (!operator) {
    throw new Error(
      `Condition step "${step.name}" does not define an operator.`
    );
  }

  const actualValue =
    getNestedValue(
      payload,
      field
    );

  const expectedValue =
    step.condition_value;

  switch (operator) {
    case "equals":
      return (
        String(
          actualValue ?? ""
        ) ===
        String(
          expectedValue ?? ""
        )
      );

    case "not_equals":
      return (
        String(
          actualValue ?? ""
        ) !==
        String(
          expectedValue ?? ""
        )
      );

    case "greater_than":
    case "greater_than_or_equal":
    case "less_than":
    case "less_than_or_equal":
      return compareNumbers(
        actualValue,
        expectedValue,
        operator
      );

    case "contains":
      if (
        Array.isArray(
          actualValue
        )
      ) {
        return actualValue.includes(
          expectedValue
        );
      }

      return String(
        actualValue ?? ""
      )
        .toLowerCase()
        .includes(
          String(
            expectedValue ?? ""
          ).toLowerCase()
        );

    case "not_contains":
      if (
        Array.isArray(
          actualValue
        )
      ) {
        return !actualValue.includes(
          expectedValue
        );
      }

      return !String(
        actualValue ?? ""
      )
        .toLowerCase()
        .includes(
          String(
            expectedValue ?? ""
          ).toLowerCase()
        );

    case "is_empty":
      return isEmpty(
        actualValue
      );

    case "is_not_empty":
      return !isEmpty(
        actualValue
      );

    case "in": {
      const values =
        Array.isArray(
          expectedValue
        )
          ? expectedValue
          : [
              expectedValue,
            ];

      return values.some(
        (value) =>
          String(value) ===
          String(actualValue)
      );
    }

    case "not_in": {
      const values =
        Array.isArray(
          expectedValue
        )
          ? expectedValue
          : [
              expectedValue,
            ];

      return !values.some(
        (value) =>
          String(value) ===
          String(actualValue)
      );
    }

    default:
      throw new Error(
        `Unsupported condition operator: ${operator}.`
      );
  }
}
