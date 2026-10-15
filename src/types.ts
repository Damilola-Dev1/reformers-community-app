export type Member = {
  id: string;
  communityId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  address: string;
  occupation: string;
  howHeard: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved';
  createdAt: string;
};