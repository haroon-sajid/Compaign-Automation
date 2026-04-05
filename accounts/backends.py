# accounts/backends.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

# Get the standard User model
UserModel = get_user_model()


class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        This method overrides the default to allow login with an email address.
        Django's LoginView passes the content of the form's "username" field
        as the 'username' argument here, regardless of its label.
        """
        try:
            # Find a user with a case-insensitive match on the email field.
            user = UserModel.objects.get(email__iexact=username)
        except UserModel.DoesNotExist:
            # No user found, authentication fails.
            return None

        # If a user is found, check their password.
        if user.check_password(password):
            # If the user was soft-deleted, reactivate them
            if not user.is_active:
                user.restore() # This sets is_active=True and saves
            
            return user # Return the user object for login

        # Password check failed.
        return None

    def get_user(self, user_id):
        try:
            return UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None
