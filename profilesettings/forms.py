# profilesettings/forms.py
from django import forms
from django.contrib.auth.models import User
from accounts.models import Profile
from django.contrib.auth.forms import PasswordChangeForm


class ProfileUpdateForm(forms.ModelForm):
    first_name = forms.CharField(
        max_length=30, required=True, label="First Name")
    last_name = forms.CharField(
        max_length=30, required=True, label="Last Name")

    class Meta:
        model = User
        fields = ['first_name', 'last_name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['first_name'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'First Name'}
        )
        self.fields['last_name'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Last Name'}
        )


class AvatarUpdateForm(forms.ModelForm):
    avatar_base64 = forms.CharField(widget=forms.HiddenInput(), required=False)

    class Meta:
        model = Profile
        fields = ['avatar_base64']


class ApiSettingsForm(forms.ModelForm):
    webhook_url = forms.URLField(
        max_length=200, required=False, label="Webhook URL")

    class Meta:
        model = Profile
        fields = ['webhook_url']


class CustomPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields['old_password'].widget = forms.PasswordInput(
            attrs={'placeholder': '********', 'class': 'form-control'}
        )
        self.fields['new_password1'].widget = forms.PasswordInput(
            attrs={'placeholder': '********', 'class': 'form-control'}
        )
        self.fields['new_password2'].widget = forms.PasswordInput(
            attrs={'placeholder': '********', 'class': 'form-control'}
        )

        for fieldname in ['old_password', 'new_password1', 'new_password2']:
            self.fields[fieldname].help_text = None
