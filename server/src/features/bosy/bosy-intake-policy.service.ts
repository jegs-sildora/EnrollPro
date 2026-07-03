export interface DocumentReadinessInput {
  isMissingSf9: boolean
  hasSf9CertificationLetter: boolean
  hasPsaBirthCertificate: boolean
  missingRequirements: string[]
}

export interface DocumentReadiness {
  isTemporarilyEnrolled: boolean
  missingDocuments: string[]
}

export function classifyDocumentReadiness(
  input: DocumentReadinessInput,
): DocumentReadiness {
  const missingDocuments: string[] = []

  if (input.isMissingSf9 && !input.hasSf9CertificationLetter) {
    missingDocuments.push("SF9 Report Card")
  }
  if (!input.hasPsaBirthCertificate) {
    missingDocuments.push("PSA Birth Certificate")
  }

  for (const requirement of input.missingRequirements) {
    const normalized = requirement.trim()
    if (normalized && !missingDocuments.includes(normalized)) {
      missingDocuments.push(normalized)
    }
  }

  return {
    isTemporarilyEnrolled: missingDocuments.length > 0,
    missingDocuments,
  }
}
