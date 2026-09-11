function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function fieldWeight(field) {
  if (
    /(?:_number|email|^id$)/i.test(
      String(field || "")
    )
  ) {
    return 100;
  }

  if (
    /(?:name|company|client|contact)/i.test(
      String(field || "")
    )
  ) {
    return 40;
  }

  return 20;
}

export function findMatchingRecord(
  prompt,
  records,
  fields
) {
  const normalisedPrompt =
    normalise(prompt);

  if (
    !normalisedPrompt ||
    !Array.isArray(records) ||
    !records.length
  ) {
    return null;
  }

  const scored =
    records
      .map((record) => {
        let score = 0;
        let strongest = 0;

        for (const field of fields || []) {
          const value =
            normalise(
              record?.[field]
            );

          if (!value) {
            continue;
          }

          if (
            normalisedPrompt.includes(
              value
            )
          ) {
            const weight =
              fieldWeight(
                field
              ) +
              Math.min(
                value.length,
                30
              );

            score +=
              weight;

            strongest =
              Math.max(
                strongest,
                weight
              );
          }
        }

        return {
          record,
          score,
          strongest,
        };
      })
      .filter(
        (item) =>
          item.score > 0
      )
      .sort(
        (a, b) =>
          b.score -
            a.score ||
          b.strongest -
            a.strongest
      );

  if (!scored.length) {
    return null;
  }

  const top =
    scored[0];

  const tied =
    scored.filter(
      (item) =>
        item.score ===
          top.score &&
        item.strongest ===
          top.strongest
    );

  /*
   * Do not silently return the first database row when two records are
   * equally good matches. The caller should ask the user for a more precise
   * identifier such as record number or email.
   */
  if (
    tied.length >
    1
  ) {
    return null;
  }

  return top.record;
}

export function detectServiceFromPrompt(
  prompt,
  profile
) {
  const normalisedPrompt =
    normalise(prompt);

  const configuredServices =
    String(
      profile?.services ||
        ""
    )
      .split(
        /[\n,;]+/
      )
      .map(
        (service) =>
          service.trim()
      )
      .filter(
        Boolean
      );

  const matchedService =
    configuredServices.find(
      (service) =>
        normalisedPrompt.includes(
          service.toLowerCase()
        )
    );

  if (matchedService) {
    return matchedService;
  }

  const genericServiceMatch =
    String(
      prompt ||
        ""
    ).match(
      /(?:for|service|needs?|requires?)\s+(.+?)(?:\s+£|\s+value|\s+email|\s+phone|$)/i
    );

  if (
    genericServiceMatch?.[1]
  ) {
    return genericServiceMatch[1]
      .trim();
  }

  return (
    configuredServices[0] ||
    "Professional Services"
  );
}
