/// The detailed attendee registration form submitted for an event.
/// Field names match Firestore 1:1. Stored at `registrations/{regId}`.
class Registration {
  final String id;
  final String eventId;
  final String userId;
  final String fullName;
  final int invitedGuestCount;
  final String hometown;
  final String currentLocation;
  final String residentialAddress;
  final String denomination;
  final String religion;
  final String gender;
  final String attendeeType;
  final String ticketType;

  const Registration({
    required this.id,
    required this.eventId,
    required this.userId,
    required this.fullName,
    this.invitedGuestCount = 0,
    this.hometown = '',
    this.currentLocation = '',
    this.residentialAddress = '',
    this.denomination = '',
    this.religion = '',
    this.gender = '',
    this.attendeeType = '',
    this.ticketType = '',
  });

  factory Registration.fromMap(String id, Map<String, dynamic> map) {
    return Registration(
      id: id,
      eventId: map['eventId'] as String? ?? '',
      userId: map['userId'] as String? ?? '',
      fullName: map['fullName'] as String? ?? '',
      invitedGuestCount: (map['invitedGuestCount'] as num?)?.toInt() ?? 0,
      hometown: map['hometown'] as String? ?? '',
      currentLocation: map['currentLocation'] as String? ?? '',
      residentialAddress: map['residentialAddress'] as String? ?? '',
      denomination: map['denomination'] as String? ?? '',
      religion: map['religion'] as String? ?? '',
      gender: map['gender'] as String? ?? '',
      attendeeType: map['attendeeType'] as String? ?? '',
      ticketType: map['ticketType'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'eventId': eventId,
      'userId': userId,
      'fullName': fullName,
      'invitedGuestCount': invitedGuestCount,
      'hometown': hometown,
      'currentLocation': currentLocation,
      'residentialAddress': residentialAddress,
      'denomination': denomination,
      'religion': religion,
      'gender': gender,
      'attendeeType': attendeeType,
      'ticketType': ticketType,
    };
  }
}
