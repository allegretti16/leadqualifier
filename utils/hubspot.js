import { Client } from '@hubspot/api-client';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export async function sendHubSpotEmail(email, message) {
  try {
    // Cerca il contatto per email
    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }
          ]
        }
      ]
    });

    let contactId;
    if (searchResponse.total === 0) {
      // Se il contatto non esiste, crealo
      const createResponse = await hubspotClient.crm.contacts.basicApi.create({
        properties: {
          email: email
        }
      });
      contactId = createResponse.id;
    } else {
      contactId = searchResponse.results[0].id;
    }

    // Crea una nota associata al contatto
    await hubspotClient.crm.objects.notes.basicApi.create({
      properties: {
        hs_note_body: message,
        hs_timestamp: new Date().toISOString(),
        hubspot_owner_id: process.env.HUBSPOT_OWNER_ID
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202
            }
          ]
        }
      ]
    });

    return { success: true, contactId };
  } catch (error) {
    console.error('Errore nell\'invio a HubSpot:', error);
    throw error;
  }
} 