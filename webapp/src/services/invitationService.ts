export class InvitationService {
  async notifyFollowers(eventId: string): Promise<void> {
    void eventId;
  }

  async sendBulkSmsInvites(params: {
    eventId: string;
    phoneNumbers: string[];
  }): Promise<void> {
    // SIMULATED
    console.log(
      `SMS invites need a real SMS gateway (Hubtel / Africa's Talking) wired server-side before use. SIMULATED send to ${params.phoneNumbers.join(
        ', ',
      )} for event ${params.eventId}`,
    );
  }

  generateRsvpLink(eventId: string): string {
    return `https://eventhub.app/r/event/${eventId}`;
  }
}

export const invitationService = new InvitationService();
