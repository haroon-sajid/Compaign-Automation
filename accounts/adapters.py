# accounts/adapters.py

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model

User = get_user_model()

class MySocialAccountAdapter(DefaultSocialAccountAdapter):

    def pre_social_login(self, request, sociallogin):
        """
        This hook is called right after a user authenticates with a social
        provider. It's our chance to look for an existing user account.
        """
        # If the user is already logged in and connecting a new social account, continue
        if sociallogin.is_existing:
            return

        # Check if a user exists with the same email address, including inactive ones
        try:
            email = sociallogin.account.extra_data.get('email')
            print("Social login email:", email)
            if email:
                # Use 'all_objects' manager to find the user
                user = User.all_objects.get(email__iexact=email)

                # If the user was soft-deleted, restore them
                if not user.is_active:
                    user.restore()

                # Connect the social account to the now-active user
                sociallogin.connect(request, user)

        except User.DoesNotExist:
            # If no user exists, allauth will proceed with the normal sign-up flow
            pass

    def populate_user(self, request, sociallogin, data):
        """
        This method is used to populate the user instance from social account data.
        """
        user = super().populate_user(request, sociallogin, data)
        
        # Here, you can extract data from the social provider to fill in your model.
        # The 'data' dictionary contains the information from the provider.
        # Example for Google:
        
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        
        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name

        # If your user model has a required `username`, you might generate one.
        # Make sure this logic creates a unique username!
        if not user.username:
            # A simple way to generate a username, but consider a more robust method
            # to avoid collisions if you expect many users with similar names.
            user.username = f"{first_name}_{last_name}"
            
        return user